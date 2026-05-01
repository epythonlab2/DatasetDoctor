# analysis/cleaning_plugins/smart_imputation.py
from typing import Any, Dict, Optional, Tuple

import pandas as pd

from datasetdoctor.core.logger import logger

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class SmartImputationPlugin(CleaningPlugin):
    """
    Intelligent imputation plugin that fills missing values based on data types.

    If 'auto' is selected, it uses statistical skewness to choose between mean
    and median for numerical data, and defaults to mode for categorical data.
    """

    name = "smart_impute"

    def run(
        self, df: pd.DataFrame, target_column: str, method: str = "auto", **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the imputation process on a specific column.

        Args:
            df: The input DataFrame.
            target_column: The name of the column to impute.
            method: Strategy to use ('auto', 'mean', 'median', 'mode', 'constant').
            **kwargs: If method='constant', use 'constant_value' to specify the value.

        Returns:
            A tuple of (cleaned_df, metadata).
        """
        if target_column not in df.columns:
            return df, {"error": f"Column '{target_column}' not found."}

        # Work on a copy to ensure the original DataFrame is not mutated unexpectedly
        df_cleaned = df.copy()
        col_data = df_cleaned[target_column]
        initial_nulls = col_data.isnull().sum()

        if initial_nulls == 0:
            return df_cleaned, {
                "imputed": False,
                "reason": f"No missing values in '{target_column}'.",
            }

        # Resolve strategy
        strategy = method
        if method == "auto":
            strategy = self._determine_strategy(col_data)

        # Calculate fill value
        fill_value = self._get_fill_value(col_data, strategy, **kwargs)

        # Apply imputation
        df_cleaned[target_column] = col_data.fillna(fill_value)

        logger.info(
            f"SmartImpute: Filled {initial_nulls} nulls in '{target_column}' "
            f"via {strategy} ({fill_value})."
        )

        return df_cleaned, {
            "column": target_column,
            "strategy_used": strategy,
            "fill_value": self._serialize_value(fill_value),
            "nulls_fixed": int(initial_nulls),
        }

    def _determine_strategy(self, series: pd.Series) -> str:
        """Heuristic to choose imputation strategy based on distribution."""
        if pd.api.types.is_numeric_dtype(series):
            # Use median for skewed data (skew > 1 or < -1), otherwise mean
            return "median" if abs(series.skew()) > 1 else "mean"
        return "mode"

    def _get_fill_value(self, series: pd.Series, strategy: str, **kwargs) -> Any:
        """Internal helper to calculate statistical fill values."""
        if strategy == "mean":
            return series.mean()
        if strategy == "median":
            return series.median()
        if strategy == "mode":
            mode_res = series.mode()
            return mode_res[0] if not mode_res.empty else None
        if strategy == "constant":
            return kwargs.get("constant_value", 0)
        return None

    def _serialize_value(self, value: Any) -> Any:
        """Ensures the fill value is JSON serializable for metadata reporting."""
        if isinstance(value, (int, float, complex)):
            return float(value)
        return str(value)
