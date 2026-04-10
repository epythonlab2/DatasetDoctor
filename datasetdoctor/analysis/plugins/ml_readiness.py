"""
ML Readiness Plugin

Evaluates whether a dataset is suitable for machine learning.

This is a composite score built from:
- Structural quality (via data_quality plugin)
- Target imbalance
- Dataset size & feature sufficiency

Design Principles:
- No double counting
- Explainable scoring
- Configurable thresholds
- Safe profile handling
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from datasetdoctor.core.logger import logger

import pandas as pd

from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class MLReadinessPlugin(AnalysisPlugin):
    """
    Computes ML readiness score using multiple signals.
    """

    name: str = "ml_readiness"
    depends_on = ["data_quality", "imbalance"]

    # Configurable thresholds
    MIN_COLUMNS = 3
    MAX_MISSING_RATIO = 0.10
    MIN_ROWS = 100

    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:

        try:
            if not isinstance(df, pd.DataFrame):
                raise TypeError("df must be a pandas DataFrame")

            if not profile:
                raise ValueError("Profile is required")

            context = context or {}

            # -------------------------
            # Extract Profile Safely
            # -------------------------
            rows = profile.get("rows", len(df))
            cols = profile.get("cols", df.shape[1])

            total_cells = max(rows * cols, 1)

            missing_counts = profile.get("missing_counts", {})
            if isinstance(missing_counts, dict):
                missing = sum(missing_counts.values())
            elif hasattr(missing_counts, "sum"):
                missing = int(missing_counts.sum())
            else:
                missing = 0

            missing_ratio = missing / total_cells

            # -------------------------
            # Dependency Outputs
            # -------------------------
            dq = context.get("data_quality")
            imb = context.get("imbalance")

            if dq is None:
                logger.warning("Missing data_quality dependency")

            if imb is None:
                logger.warning("Missing imbalance dependency")

            dq_score = dq.get("score") if isinstance(dq, dict) else None
            is_imbalanced = (
                imb.get("is_imbalanced") if isinstance(imb, dict) else False
            )

            # -------------------------
            # Scoring Components
            # -------------------------
            penalties = []

            if rows < self.MIN_ROWS:
                penalties.append(("low_sample_size", 20))

            if cols < self.MIN_COLUMNS:
                penalties.append(("insufficient_features", 15))

            if missing_ratio > self.MAX_MISSING_RATIO:
                penalties.append(("high_missing_values", 20))

            if profile.get("any_duplicates"):
                penalties.append(("duplicate_rows", 10))

            if is_imbalanced:
                penalties.append(("target_imbalance", 10))

            # -------------------------
            # Base Score
            # -------------------------
            base_score = 100 - sum(p[1] for p in penalties)

            # Blend with data quality WITHOUT double counting
            if dq_score is not None:
                final_score = (0.6 * base_score) + (0.4 * dq_score)
            else:
                final_score = base_score

            # -------------------------
            # Output
            # -------------------------
            return {
                "value": int(max(final_score, 0)),
                "penalties": penalties,
                "summary": {
                    "rows": rows,
                    "cols": cols,
                    "missing_ratio": round(missing_ratio, 4),
                    "used_data_quality": dq_score is not None,
                },
            }

        except Exception as exc:
            logger.exception("ML readiness analysis failed: %s", str(exc))
            return {
                "value": 0,
                "error": str(exc),
            }
