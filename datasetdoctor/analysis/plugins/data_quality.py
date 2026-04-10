"""
Data Quality Analysis Plugin

Evaluates dataset quality using:
- Missing value ratio
- Duplicate row ratio
- Constant column ratio

Design Principles:
- Profile-driven (no redundant computation)
- Safe against schema drift
- Configurable scoring
- Memory-aware
- Observable (logging + metadata)
"""

from __future__ import annotations

from datasetdoctor.core.logger import logger
from typing import Any, Dict, Optional

import pandas as pd

from .base import AnalysisPlugin
from .registry import register_plugin



@register_plugin
class DataQualityPlugin(AnalysisPlugin):
    """
    Computes a dataset quality score based on structural issues.
    """

    name: str = "data_quality"

    # Configurable weights
    WEIGHTS = {
        "missing": 40.0,
        "duplicate": 25.0,
        "constant": 20.0,
    }

    MAX_ROWS_FOR_DUP_SCAN = 1_000_000

    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute data quality scoring.

        Returns:
            Dict[str, Any]: Quality score and diagnostics
        """

        try:
            # -------------------------
            # Validation
            # -------------------------
            if not isinstance(df, pd.DataFrame):
                raise TypeError("df must be a pandas DataFrame")

            if not profile:
                raise ValueError("Profile is required for data quality analysis")

            rows = profile.get("rows", len(df))
            cols = profile.get("cols", df.shape[1])

            if rows == 0 or cols == 0:
                return self._empty_result("Empty dataset")

            total_cells = rows * cols

            # -------------------------
            # Missing Values
            # -------------------------
            missing_counts = profile.get("missing_counts", {})

            if isinstance(missing_counts, dict):
                missing = sum(missing_counts.values())
            elif hasattr(missing_counts, "sum"):
                missing = int(missing_counts.sum())
            else:
                missing = 0
                logger.warning("Invalid missing_counts format")

            m_ratio = missing / total_cells

            # -------------------------
            # Duplicates (guarded)
            # -------------------------
            duplicates = 0
            if profile.get("any_duplicates", False):
                if rows <= self.MAX_ROWS_FOR_DUP_SCAN:
                    duplicates = int(df.duplicated().sum())
                else:
                    logger.warning("Skipping duplicate scan due to dataset size")

            d_ratio = duplicates / rows

            # -------------------------
            # Constant Columns
            # -------------------------
            nunique = profile.get("nunique", {})

            if isinstance(nunique, dict):
                constant_cols = sum(1 for v in nunique.values() if v <= 1)
            elif hasattr(nunique, "__le__"):
                constant_cols = int((nunique <= 1).sum())
            else:
                constant_cols = 0
                logger.warning("Invalid nunique format")

            c_ratio = constant_cols / cols

            # -------------------------
            # Scoring
            # -------------------------
            score = self._compute_score(m_ratio, d_ratio, c_ratio)

            return {
                "score": score,
                "ratios": {
                    "missing": round(m_ratio, 4),
                    "duplicate": round(d_ratio, 4),
                    "constant": round(c_ratio, 4),
                },
                "meta": {
                    "rows": rows,
                    "cols": cols,
                    "duplicates_checked": rows <= self.MAX_ROWS_FOR_DUP_SCAN,
                },
            }

        except Exception as exc:
            logger.exception("Data quality analysis failed: %s", str(exc))
            return {
                "score": 0.0,
                "error": str(exc),
            }

    # -------------------------
    # Internal Methods
    # -------------------------

    def _compute_score(self, m: float, d: float, c: float) -> float:
        """
        Compute weighted quality score.

        Returns:
            float: Score between 0 and 100
        """
        penalty = (
            m * self.WEIGHTS["missing"]
            + d * self.WEIGHTS["duplicate"]
            + c * self.WEIGHTS["constant"]
        )

        return round(max(100.0 - penalty, 0.0), 2)

    def _empty_result(self, reason: str) -> Dict[str, Any]:
        return {
            "score": 0.0,
            "details": reason,
            "ratios": {"missing": 0, "duplicate": 0, "constant": 0},
        }
