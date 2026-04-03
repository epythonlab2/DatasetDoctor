from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.feature_selection import (mutual_info_classif,
                                       mutual_info_regression)
from sklearn.preprocessing import LabelEncoder

from datasetdoctor.core.logger import logger

from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class PredictivePowerPlugin(AnalysisPlugin):
    """
    Plugin to estimate the predictive strength of features relative to a target.

    Uses Mutual Information (MI) combined with a 'Stability Score' derived from
    multiple bootstrap runs to ensure the predictive signal is consistent and
    not just noise.
    """

    name = "predictive_power"

    def run(
        self, df: pd.DataFrame, target: str = None, profile=None, context=None
    ) -> Dict[str, Any]:
        """Main entry point for the analysis plugin."""
        if target is None or target not in df.columns:
            return {}

        try:
            # Drop rows where target is missing as we cannot analyze predictive power without ground truth
            working_df = df.dropna(subset=[target]).copy()
            if working_df.empty:
                return {}

            y_raw = working_df[target]
            X_raw = working_df.drop(columns=[target])

            # 1. Task Detection (Classification vs Regression)
            is_classification = self._detect_task(y_raw)

            # 2. Target Encoding
            if is_classification:
                y = LabelEncoder().fit_transform(y_raw.astype(str))
            else:
                y = y_raw.values

            # 3. Feature Engineering for MI
            # We must convert strings to factors and handle NaNs for sklearn compatibility
            X_processed, discrete_mask = self._prepare_features(X_raw)

            if X_processed.empty:
                return {}

            # 4. Parallel Computation of MI Scores
            return self._compute_parallel(
                X_processed, y, is_classification, discrete_mask
            )

        except Exception as e:
            logger.error(f"PredictivePower: Critical failure: {e}", exc_info=True)
            return {}

    def _prepare_features(self, X: pd.DataFrame) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Prepares raw data for Mutual Information calculation.
        Returns processed DataFrame and a boolean mask indicating discrete features.
        """
        processed_data = {}
        discrete_flags = []

        for col in X.columns:
            try:
                col_data = X[col]

                # Skip constant columns (no predictive power)
                if col_data.nunique(dropna=True) <= 1:
                    continue

                # --- Numeric Logic ---
                if pd.api.types.is_numeric_dtype(col_data):
                    # Flag missing values as a separate discrete feature
                    if col_data.isna().any():
                        processed_data[f"{col}_missing"] = col_data.isna().astype(int)
                        discrete_flags.append(True)

                    # Median imputation for numeric
                    filled = col_data.fillna(
                        col_data.median() if not col_data.isna().all() else 0
                    )
                    processed_data[col] = filled

                    # Determine if numeric column is effectively discrete (e.g., small set of integers)
                    is_disc = pd.api.types.is_integer_dtype(
                        col_data
                    ) and col_data.nunique() < min(50, len(col_data) * 0.2)
                    discrete_flags.append(is_disc)

                # --- Datetime Logic ---
                elif pd.api.types.is_datetime64_any_dtype(col_data):
                    dt = pd.to_datetime(col_data, errors="coerce")
                    processed_data[f"{col}_year"] = dt.dt.year.fillna(0)
                    processed_data[f"{col}_month"] = dt.dt.month.fillna(0)
                    processed_data[f"{col}_day"] = dt.dt.day.fillna(0)
                    discrete_flags.extend([True, True, True])

                # --- Categorical/Object Logic ---
                else:
                    # Factorize strings into integers for MI consumption
                    encoded = pd.factorize(col_data.fillna("missing"))[0]
                    processed_data[col] = encoded
                    discrete_flags.append(True)

            except Exception as e:
                logger.error(f"PredictivePower: Failed feature {col}: {str(e)}")

        if not processed_data:
            return pd.DataFrame(), np.array([])

        return pd.DataFrame(processed_data, index=X.index), np.array(discrete_flags)

    def _compute_parallel(
        self, X: pd.DataFrame, y: np.ndarray, is_class: bool, discrete_mask: np.ndarray
    ) -> Dict[str, Any]:
        """Orchestrates chunked parallel processing of feature importance."""
        col_names = X.columns.tolist()
        chunk_size = 20
        final_results = {}

        with ThreadPoolExecutor() as executor:
            futures = []
            for i in range(0, len(col_names), chunk_size):
                cols_chunk = col_names[i : i + chunk_size]
                mask_chunk = discrete_mask[i : i + chunk_size]

                futures.append(
                    executor.submit(
                        self._compute_chunk, X[cols_chunk], y, is_class, mask_chunk
                    )
                )

            for future in futures:
                try:
                    final_results.update(future.result())
                except Exception as e:
                    logger.error(f"PredictivePower: Chunk calculation failed: {e}")

        return final_results

    def _compute_chunk(
        self,
        X_chunk: pd.DataFrame,
        y: np.ndarray,
        is_class: bool,
        mask_chunk: np.ndarray,
    ) -> Dict[str, Any]:
        """Calculates combined MI, Correlation, and Stability for a subset of features."""
        try:
            mean_mi, std_mi = self._compute_stability(X_chunk, y, is_class, mask_chunk)
            results = {}

            # Normalization factor to scale MI scores between 0 and 1
            max_mi_in_chunk = mean_mi.max() if len(mean_mi) > 0 else 1.0

            for i, col in enumerate(X_chunk.columns):
                mi = float(mean_mi[i])
                std = float(std_mi[i])
                norm_mi = mi / (max_mi_in_chunk + 1e-6)

                # Linear correlation check (only relevant for regression tasks)
                corr = 0.0
                if not is_class:
                    try:
                        corr = abs(np.corrcoef(X_chunk[col], y)[0, 1])
                    except:
                        pass

                # Stability score: penalizes features that fluctuate wildly across bootstrap samples
                stability = self._stability_confidence(mi, std)

                # Weighted final score (60% MI, 40% Correlation) adjusted by stability
                weighted_score = (0.6 * norm_mi + 0.4 * corr) * stability

                flags = []
                if norm_mi > 0.95 and stability > 0.9:
                    flags.append("leakage_risk")

                results[col] = {
                    "score": round(float(weighted_score), 4),
                    "mi": round(mi, 4),
                    "corr": round(corr, 4),
                    "stability": round(stability, 4),
                    "flags": flags,
                }
            return results

        except Exception as e:
            logger.error(f"PredictivePower: Error in chunk processing: {e}")
            return {col: {"score": 0.0} for col in X_chunk.columns}

    def _compute_stability(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        is_class: bool,
        mask: np.ndarray,
        n_runs: int = 5,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Runs MI multiple times on random subsamples to detect variance in predictive power."""
        all_scores = []
        n_samples = len(y)
        mi_func = mutual_info_classif if is_class else mutual_info_regression

        for _ in range(n_runs):
            # Bootstrap 80% of data
            idx = np.random.choice(n_samples, int(n_samples * 0.8), replace=False)
            scores = mi_func(
                X.iloc[idx], y[idx], discrete_features=mask, random_state=42
            )
            all_scores.append(scores)

        all_scores_arr = np.array(all_scores)
        return all_scores_arr.mean(axis=0), all_scores_arr.std(axis=0)

    def _stability_confidence(self, mean: float, std: float) -> float:
        """Translates Mean/Std Dev into a 0.0-1.0 confidence score."""
        if mean <= 1e-6:
            return 0.0
        # If standard deviation equals the mean, confidence is zero.
        return max(0.0, 1.0 - (std / (mean + 1e-6)))

    def _detect_task(self, y: pd.Series) -> bool:
        """Heuristic to determine if the target represents a classification task."""
        if y.dtype in ["object", "bool"] or y.dtype.name == "category":
            return True

        # If integer, check if the cardinality is low enough to be categorical
        if pd.api.types.is_integer_dtype(y):
            return y.nunique() < min(20, len(y) * 0.1)

        return False
