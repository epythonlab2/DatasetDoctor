# analysis/cleaning_plugins/smart_casting.py
from typing import Tuple, Dict, Any, Optional
import pandas as pd
import numpy as np

from datasetdoctor.core.logger import logger
from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class SmartCastPlugin(CleaningPlugin):
    """
    Plugin to transform column data types (Casting).
    
    Supports automatic type inference or explicit casting to date, float, 
    integer, boolean, or label-encoded integers. Uses nullable types 
    (e.g., 'Int64', 'boolean') to preserve NaN values where possible.
    """

    # Matches the 'action' and 'plugin_params' key in the background task
    name = "cast_schema"

    def run(
        self, 
        df: pd.DataFrame, 
        target_column: str, 
        method: str = "auto", 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the casting logic on a specific column.

        Args:
            df: Input DataFrame.
            target_column: Column to transform.
            method: Type strategy ('auto', 'date', 'float', 'int', 'bool', 'encode').
            **kwargs: Additional parameters for specific cast types.

        Returns:
            Tuple of (cleaned_df, metadata).
        """
        if target_column not in df.columns:
            return df, {"error": f"Column '{target_column}' not found."}

        df_cleaned = df.copy()
        initial_dtype = str(df_cleaned[target_column].dtype)
        
        # Resolve target type
        target_type = method
        if method == "auto":
            target_type = self._determine_target_type(df_cleaned[target_column])

        logger.info(f"SmartCast: Attempting {target_column} ({initial_dtype} -> {target_type})")

        try:
            df_cleaned[target_column] = self._apply_cast(
                df_cleaned[target_column], 
                target_type
            )
        except Exception as e:
            logger.error(f"SmartCast failed for '{target_column}': {str(e)}")
            return df, {
                "error": f"Conversion failed: {str(e)}", 
                "column": target_column,
                "success": False
            }

        final_dtype = str(df_cleaned[target_column].dtype)
        logger.info(f"SmartCast: Successfully cast '{target_column}' to {final_dtype}")

        return df_cleaned, {
            "column": target_column,
            "strategy_used": target_type,
            "old_dtype": initial_dtype,
            "new_dtype": final_dtype,
            "success": True
        }

    def _apply_cast(self, series: pd.Series, target_type: str) -> pd.Series:
        """Internal router for casting logic."""
        
        if target_type in ["date", "datetime"]:
            return pd.to_datetime(series, errors='coerce')

        if target_type in ["float", "numeric"]:
            return pd.to_numeric(series, errors='coerce').astype(float)

        if target_type in ["int", "integer"]:
            # Uses 'Int64' (capital I) to support NaNs in integer columns
            return pd.to_numeric(series, errors='coerce').round().astype("Int64")

        if target_type in ["bool", "boolean"]:
            bool_map = {
                'true': True, 'false': False, '1': True, '0': False, 
                1: True, 0: False, True: True, False: False
            }
            return series.astype(str).str.lower().str.strip().map(bool_map).astype("boolean")

        if target_type == "encode":
            unique_vals = sorted(series.dropna().unique())
            mapping = {val: idx for idx, val in enumerate(unique_vals)}
            encoded = series.map(mapping)
            
            if encoded.isna().any() and series.notna().any():
                missing = series[encoded.isna() & series.notna()].unique()
                raise ValueError(f"Unmapped values found during encoding: {missing}")
            
            # Returns as nullable Int64 so NaNs remain NaNs rather than -1 or error
            return encoded.astype("Int64")

        raise ValueError(f"Unsupported target type: {target_type}")

    def _determine_target_type(self, series: pd.Series) -> str:
        """Heuristic to guess the best data type for a column based on top 100 rows."""
        sample = series.dropna().head(100)
        if sample.empty:
            return "string"

        # 1. Try Datetime
        try:
            pd.to_datetime(sample, errors='raise')
            return "date"
        except (ValueError, TypeError):
            pass

        # 2. Try Numeric
        try:
            num_sample = pd.to_numeric(sample, errors='raise')
            # Check if values are whole numbers (integers)
            if np.isclose(num_sample % 1, 0).all():
                return "int"
            return "float"
        except (ValueError, TypeError):
            pass

        return "string"
