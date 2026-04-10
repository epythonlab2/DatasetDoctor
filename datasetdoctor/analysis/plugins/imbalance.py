"""
Imbalance Analysis Plugin

Detects class imbalance in classification targets.

Supports:
- Binary and multi-class targets
- Configurable imbalance thresholds
- High-cardinality safeguards
- Detailed diagnostics

"""

from __future__ import annotations

from datasetdoctor.core.logger import logger
from typing import Any, Dict, Optional

import pandas as pd

from .base import AnalysisPlugin
from .registry import register_plugin



@register_plugin
class ImbalancePlugin(AnalysisPlugin):
    """
    Detects imbalance in target variable.
    """

    name: str = "imbalance"

    # Configurable thresholds
    DOMINANCE_THRESHOLD: float = 0.80
    EXTREME_DOMINANCE_THRESHOLD: float = 0.95
    MAX_CLASSES: int = 1000  # prevent explosion

    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze class imbalance.

        Returns:
            Dict[str, Any]
        """

        try:
            # -------------------------
            # Validation
            # -------------------------
            if not isinstance(df, pd.DataFrame):
                raise TypeError("df must be a pandas DataFrame")

            if not target or target not in df.columns:
                return self._empty_result("No valid target column")

            series = df[target]

            if series.empty:
                return self._empty_result("Target column is empty")

            # -------------------------
            # Cardinality Check
            # -------------------------
            unique_classes = series.nunique(dropna=False)

            if unique_classes > self.MAX_CLASSES:
                logger.warning(
                    "High cardinality target (%d classes). Skipping imbalance analysis.",
                    unique_classes,
                )
                return self._empty_result("Target has too many unique values")

            # -------------------------
            # Distribution
            # -------------------------
            dist = series.value_counts(normalize=True, dropna=False)

            max_ratio = float(dist.max())
            min_ratio = float(dist.min())
            num_classes = len(dist)

            # -------------------------
            # Imbalance Classification
            # -------------------------
            if max_ratio >= self.EXTREME_DOMINANCE_THRESHOLD:
                severity = "EXTREME"
            elif max_ratio >= self.DOMINANCE_THRESHOLD:
                severity = "HIGH"
            elif max_ratio >= 0.6:
                severity = "MODERATE"
            else:
                severity = "LOW"

            is_imbalanced = severity in {"HIGH", "EXTREME"}

            # -------------------------
            # Output
            # -------------------------
            return {
                "target_column": target,
                "num_classes": num_classes,
                "distribution": {
                    str(k): round(v, 4) for k, v in dist.items()
                },
                "majority_class_ratio": round(max_ratio, 4),
                "minority_class_ratio": round(min_ratio, 4),
                "imbalance_severity": severity,
                "is_imbalanced": is_imbalanced,
                "missing_ratio": round(series.isna().mean(), 4),
                "meta": {
                    "rows": len(series),
                },
            }

        except Exception as exc:
            logger.exception("Imbalance analysis failed: %s", str(exc))
            return {
                "error": str(exc),
                "is_imbalanced": False,
            }

    # -------------------------
    # Helpers
    # -------------------------

    def _empty_result(self, reason: str) -> Dict[str, Any]:
        return {
            "is_imbalanced": False,
            "details": reason,
            "distribution": {},
        }
