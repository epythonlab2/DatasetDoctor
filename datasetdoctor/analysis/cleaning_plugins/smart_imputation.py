# analysis/cleaning_plugins/smart_imputation.py
from datasetdoctor.core.logger import logger
from typing import Tuple, Dict, Any, Optional
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class SmartImputationPlugin(CleaningPlugin):
    name = "smart_impute"

    def run(
        self, 
        df: pd.DataFrame, 
        target_column: str, 
        method: str = "auto", 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        
        if target_column not in df.columns:
            return df, {"error": f"Column '{target_column}' not found."}

        # Ensure we are working with a copy to avoid SettingWithCopy warnings
        df_cleaned = df.copy()
        col_data = df_cleaned[target_column]
        initial_nulls = col_data.isnull().sum()
        
        if initial_nulls == 0:
            return df_cleaned, {"imputed": False, "reason": "No missing values found."}

        # Strategy selection
        strategy = method
        if method == "auto":
            strategy = self._determine_strategy(col_data)

        fill_value = None

        # Apply Imputation Strategies
        if strategy == "mean":
            fill_value = col_data.mean()
        elif strategy == "median":
            fill_value = col_data.median()
        elif strategy == "mode":
            mode_result = col_data.mode()
            fill_value = mode_result[0] if not mode_result.empty else None
        elif strategy == "constant":
            fill_value = kwargs.get("constant_value", 0)

        # FIX: Changed fill_na() to fillna()
        df_cleaned[target_column] = col_data.fillna(fill_value)

        logger.info(f"Imputed {initial_nulls} values in '{target_column}' using {strategy} with value {fill_value}.")

        return df_cleaned, {
            "column": target_column,
            "strategy_used": strategy,
            "inferred_value": float(fill_value) if isinstance(fill_value, (int, float, complex)) else str(fill_value),
            "nulls_fixed": int(initial_nulls)
        }

    def _determine_strategy(self, series: pd.Series) -> str:
        if pd.api.types.is_numeric_dtype(series):
            # If skewed, median is statistically better
            return "median" if abs(series.skew()) > 1 else "mean"
        return "mode"
