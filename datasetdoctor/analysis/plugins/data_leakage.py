"""
Data Leakage Analysis Plugin

This module detects potential data leakage risks in a dataset by analyzing:
- Perfect predictors (near-perfect correlation with target)
- Highly correlated features
- Duplicate columns (feature redundancy)

Security & Reliability Considerations:
- Input validation to prevent malformed data issues
- Safe floating-point comparisons
- Configurable thresholds
- Memory-aware operations
- Defensive programming (fail-safe outputs)
"""

from __future__ import annotations

from datasetdoctor.core.logger import logger
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .base import AnalysisPlugin
from .registry import register_plugin



@register_plugin
class DataLeakagePlugin(AnalysisPlugin):
    """
    Plugin to detect potential data leakage risks.

    Attributes:
        name (str): Unique plugin identifier.
    """

    name: str = "data_leakage"

    # Thresholds (can later be moved to config)
    PERFECT_CORRELATION_THRESHOLD: float = 0.9999
    HIGH_CORRELATION_THRESHOLD: float = 0.90
    MAX_ROWS_FOR_FULL_SCAN: int = 1_000_000  # Prevent excessive memory usage

    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute leakage detection.

        Args:
            df (pd.DataFrame): Input dataset.
            target (Optional[str]): Target column name.
            profile (Optional[Dict]): Precomputed dataset profile.
            context (Optional[Dict]): Execution context.

        Returns:
            Dict[str, Any]: Structured leakage analysis results.
        """

        try:
            # -------------------------
            # Input Validation
            # -------------------------
            if not isinstance(df, pd.DataFrame):
                raise TypeError("Input 'df' must be a pandas DataFrame")

            if df.empty:
                return self._empty_result("Dataset is empty")

            if not target or target not in df.columns:
                return self._empty_result("No valid target specified")

            if len(df) > self.MAX_ROWS_FOR_FULL_SCAN:
                logger.warning(
                    "Dataset too large for full leakage scan (%d rows). Sampling applied.",
                    len(df),
                )
                df = df.sample(n=self.MAX_ROWS_FOR_FULL_SCAN, random_state=42)

            # -------------------------
            # Feature Preparation
            # -------------------------
            features = df.drop(columns=[target], errors="ignore")
            numeric_features = features.select_dtypes(include=np.number)

            perfect_predictors: List[str] = []
            high_correlation: List[str] = []

            # -------------------------
            # Correlation Analysis
            # -------------------------
            if not numeric_features.empty and pd.api.types.is_numeric_dtype(df[target]):
                correlations = numeric_features.corrwith(df[target])

                for col, val in correlations.items():
                    if pd.isna(val):
                        continue

                    abs_val = abs(val)

                    # Safe float comparison
                    if abs_val >= self.PERFECT_CORRELATION_THRESHOLD:
                        perfect_predictors.append(col)
                    elif abs_val >= self.HIGH_CORRELATION_THRESHOLD:
                        high_correlation.append(col)

            # -------------------------
            # Duplicate Column Detection
            # -------------------------
            duplicate_columns = self._find_duplicate_columns(features)

            # -------------------------
            # Risk Assessment
            # -------------------------
            risk_level = self._assess_risk(
                perfect_predictors, high_correlation, duplicate_columns
            )

            return {
                "leakage_risk": risk_level,
                "perfect_predictors": perfect_predictors,
                "high_correlation": high_correlation,
                "duplicate_columns": duplicate_columns,
                "meta": {
                    "rows_analyzed": len(df),
                    "numeric_features": len(numeric_features.columns),
                },
            }

        except Exception as exc:
            logger.exception("Data leakage analysis failed: %s", str(exc))
            return {
                "leakage_risk": "UNKNOWN",
                "error": str(exc),
            }

    # -------------------------
    # Internal Helpers
    # -------------------------

    def _find_duplicate_columns(self, df: pd.DataFrame) -> List[str]:
        """
        Detect duplicate columns efficiently.

        Args:
            df (pd.DataFrame): Feature dataframe

        Returns:
            List[str]: List of duplicate column names
        """
        try:
            if df.empty:
                return []

            # Transpose-based duplication detection
            duplicates = df.T.duplicated()
            return df.columns[duplicates].tolist()

        except Exception as exc:
            logger.warning("Duplicate column detection failed: %s", str(exc))
            return []

    def _assess_risk(
        self,
        perfect: List[str],
        high_corr: List[str],
        duplicates: List[str],
    ) -> str:
        """
        Determine leakage risk level.

        Returns:
            str: Risk level (NONE, LOW, HIGH)
        """
        if perfect:
            return "HIGH"

        if len(high_corr) > 2 or duplicates:
            return "HIGH"

        if high_corr:
            return "LOW"

        return "NONE"

    def _empty_result(self, reason: str) -> Dict[str, Any]:
        """
        Standardized empty result response.

        Args:
            reason (str): Explanation

        Returns:
            Dict[str, Any]
        """
        return {
            "leakage_risk": "NONE",
            "details": reason,
            "perfect_predictors": [],
            "high_correlation": [],
            "duplicate_columns": [],
        }
