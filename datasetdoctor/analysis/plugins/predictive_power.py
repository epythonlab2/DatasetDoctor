import numpy as np
import pandas as pd

from typing import Dict, Tuple, Any
from concurrent.futures import ThreadPoolExecutor

from sklearn.preprocessing import LabelEncoder
from sklearn.feature_selection import mutual_info_classif, mutual_info_regression

from datasetdoctor.core.logger import logger
from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class PredictivePowerPlugin(AnalysisPlugin):
    name = "predictive_power"

    # =========================
    # MAIN ENTRY
    # =========================
    def run(self, df: pd.DataFrame, target=None, profile=None, context=None) -> Dict[str, Any]:
        if target is None or target not in df.columns:
            return {}

        try:
            working_df = df.dropna(subset=[target]).copy()
            if working_df.empty:
                return {}

            y_raw = working_df[target]
            X_raw = working_df.drop(columns=[target])

            is_classification = self._detect_task(y_raw)

            if is_classification:
                y = LabelEncoder().fit_transform(y_raw.astype(str))
            else:
                y = y_raw.values

            X_processed, discrete_mask = self._prepare_features(X_raw)

            if X_processed.empty:
                return {}

            results = self._compute_parallel(
                X_processed, y, is_classification, discrete_mask
            )


            return results
            

        except Exception as e:
            logger.error(f"PredictivePower: Critical failure: {e}", exc_info=True)
            return {}

    # =========================
    # FEATURE PREP
    # =========================
    def _prepare_features(self, X: pd.DataFrame) -> Tuple[pd.DataFrame, np.ndarray]:
        processed_data = {}
        discrete_flags = []

        for col in X.columns:
            try:
                col_data = X[col]

                # Skip constant
                if col_data.nunique(dropna=True) <= 1:
                    continue

                # ---- NUMERIC ----
                if pd.api.types.is_numeric_dtype(col_data):
                    if col_data.isna().any():
                        processed_data[f"{col}_missing"] = col_data.isna().astype(int)
                        discrete_flags.append(True)

                    filled = col_data.fillna(
                        col_data.median() if not col_data.isna().all() else 0
                    )
                    processed_data[col] = filled

                    # discrete detection
                    if pd.api.types.is_integer_dtype(col_data):
                        is_disc = col_data.nunique() < min(50, len(col_data) * 0.2)
                    else:
                        is_disc = False

                    discrete_flags.append(is_disc)

                # ---- DATETIME ----
                elif pd.api.types.is_datetime64_any_dtype(col_data):
                    dt = pd.to_datetime(col_data, errors="coerce")

                    processed_data[f"{col}_year"] = dt.dt.year.fillna(0)
                    processed_data[f"{col}_month"] = dt.dt.month.fillna(0)
                    processed_data[f"{col}_day"] = dt.dt.day.fillna(0)

                    discrete_flags.extend([True, True, True])

                # ---- CATEGORICAL ----
                else:
                    encoded = pd.factorize(col_data.fillna("missing"))[0]
                    processed_data[col] = encoded
                    discrete_flags.append(True)

            except Exception as e:
                logger.error(f"PredictivePower: Failed feature {col}. Error: {str(e)}")

        if not processed_data:
            return pd.DataFrame(), np.array([])

        X_encoded = pd.DataFrame(processed_data, index=X.index)

        return X_encoded, np.array(discrete_flags)

    # =========================
    # PARALLEL COMPUTE
    # =========================
    def _compute_parallel(self, X, y, is_class, discrete_mask):
        col_names = X.columns.tolist()
        chunk_size = 20
        final_results = {}

        with ThreadPoolExecutor() as executor:
            futures = []

            for i in range(0, len(col_names), chunk_size):
                cols_chunk = col_names[i: i + chunk_size]
                mask_chunk = discrete_mask[i: i + chunk_size]

                futures.append(
                    executor.submit(
                        self._compute_chunk,
                        X[cols_chunk],
                        y,
                        is_class,
                        mask_chunk
                    )
                )

            for future in futures:
                try:
                    final_results.update(future.result())
                except Exception as e:
                    logger.error(f"PredictivePower: Chunk failed: {e}")

        return final_results

    # =========================
    # CORE LOGIC (STABILITY + SCORING)
    # =========================
    def _compute_chunk(self, X_chunk, y, is_class, mask_chunk):
        try:
            mean_mi, std_mi = self._compute_stability(
                X_chunk, y, is_class, mask_chunk
            )

            results = {}
            max_mi = mean_mi.max() if len(mean_mi) > 0 else 1

            for i, col in enumerate(X_chunk.columns):
                mi = float(mean_mi[i])
                std = float(std_mi[i])

                norm_mi = mi / (max_mi + 1e-6)

                # correlation (regression only)
                if not is_class:
                    try:
                        corr = abs(np.corrcoef(X_chunk[col], y)[0, 1])
                    except Exception:
                        corr = 0.0
                else:
                    corr = 0.0

                stability = self._stability_confidence(mi, std)

                score = (0.6 * norm_mi + 0.4 * corr) * stability

                flags = []
                if norm_mi > 0.9 and stability > 0.9:
                    flags.append("leakage_risk")

                results[col] = {
                    "score": float(score),
                    "mi": mi,
                    "corr": corr,
                    "stability": stability,
                    "flags": flags,
                }

            return results

        except Exception as e:
            logger.error(f"PredictivePower: Error in chunk: {e}")
            return {col: {"score": 0.0} for col in X_chunk.columns}

    # =========================
    # STABILITY COMPUTATION
    # =========================
    def _compute_stability(self, X, y, is_class, mask, n_runs=5):
        all_scores = []
        n = len(y)

        func = mutual_info_classif if is_class else mutual_info_regression

        for _ in range(n_runs):
            idx = np.random.choice(n, int(n * 0.8), replace=False)

            X_sample = X.iloc[idx]
            y_sample = y[idx]

            scores = func(
                X_sample,
                y_sample,
                discrete_features=mask,
                random_state=None
            )

            all_scores.append(scores)

        all_scores = np.array(all_scores)

        return all_scores.mean(axis=0), all_scores.std(axis=0)

    # =========================
    # STABILITY → CONFIDENCE
    # =========================
    def _stability_confidence(self, mean, std):
        if mean <= 1e-6:
            return 0.0
        return max(0.0, 1 - (std / (mean + 1e-6)))

    # =========================
    # TASK DETECTION
    # =========================
    def _detect_task(self, y: pd.Series) -> bool:
        if y.dtype == 'object' or y.dtype.name == 'category' or y.dtype == 'bool':
            return True

        if pd.api.types.is_integer_dtype(y):
            return y.nunique() < min(20, len(y) * 0.1)

        return False
