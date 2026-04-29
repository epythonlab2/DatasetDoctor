# analysis/cleaning_plugins/smart_cast.py

from typing import Tuple, Dict, Any, Optional, List
import pandas as pd
import numpy as np

from datasetdoctor.core.logger import logger
from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class SmartCastPlugin(CleaningPlugin):
    """
    Advanced schema casting plugin with heuristic type detection.

    Supports explicit casting to numeric, datetime, boolean, and categorical 
    encoding, or 'auto' mode which uses heuristics to guess the best fit.
    """

    # Matches the 'action' and 'plugin_params' key in backend tasks
    name: str = "cast_schema"

    def run(
        self, 
        df: pd.DataFrame, 
        target_column: str, 
        method: str = "auto", 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Attempts to cast a column to a specific or auto-detected data type.

        Args:
            df (pd.DataFrame): The input DataFrame.
            target_column (str): Name of the column to transform.
            method (str): Casting strategy ('auto', 'date', 'float', 'int', 
                'bool', 'encode'). Defaults to "auto".
            **kwargs: Additional options (e.g., date formats).

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: Transformed DataFrame and 
                casting metadata or error details.
        """
        if target_column not in df.columns:
            return df, {"error": f"Column '{target_column}' not found."}

        df_cleaned = df.copy()
        initial_dtype = str(df_cleaned[target_column].dtype)
        
        # Strategy selection
        target_type = method
        if method == "auto":
            target_type = self._determine_target_type(df_cleaned[target_column])

        logger.info(f"Cast attempt on '{target_column}': {initial_dtype} -> {target_type}")

        try:
            if target_type in ["date", "datetime"]:
                df_cleaned[target_column] = pd.to_datetime(
                    df_cleaned[target_column], errors='coerce'
                )
            
            elif target_type in ["float", "numeric"]:
                # Force to float64 even if input is integer
                df_cleaned[target_column] = pd.to_numeric(
                    df_cleaned[target_column], errors='coerce'
                ).astype(float)
            
            elif target_type in ["int", "integer"]:
                # Use nullable Int64 to allow integers and NaNs to coexist
                df_cleaned[target_column] = (
                    pd.to_numeric(df_cleaned[target_column], errors='coerce')
                    .round()
                    .astype("Int64")
                )
            
            elif target_type in ["bool", "boolean"]:
                bool_map = {
                    'true': True, 'false': False, 
                    '1': True, '0': False, 
                    1: True, 0: False,
                    True: True, False: False
                }
                # Standardize to string for mapping, then use nullable boolean
                df_cleaned[target_column] = (
                    df_cleaned[target_column]
                    .astype(str)
                    .str.lower()
                    .map(bool_map)
                    .astype("boolean")
                )
            
            elif target_type == "encode":
                series = df_cleaned[target_column]
                unique_vals = sorted(series.dropna().unique())
                mapping = {val: idx for idx, val in enumerate(unique_vals)}
                
                encoded = series.map(mapping)
                
                if encoded.isna().any() and not series.isna().any():
                    missing = series[encoded.isna()].unique()
                    raise ValueError(f"Unmapped values found: {missing}")

                df_cleaned[target_column] = encoded.astype("Int64")
                            
            else:
                return df, {"error": f"Unsupported target type: {target_type}"}

        except Exception as e:
            logger.error(f"Cast failed for '{target_column}': {str(e)}")
            return df, {
                "error": f"Conversion failed: {str(e)}", 
                "column": target_column,
                "success": False
            }

        final_dtype = str(df_cleaned[target_column].dtype)
        logger.info(f"Successfully cast '{target_column}' to {final_dtype}")

        return df_cleaned, {
            "column": target_column,
            "strategy_used": target_type,
            "old_dtype": initial_dtype,
            "new_dtype": final_dtype,
            "success": True
        }

    def _determine_target_type(self, series: pd.Series) -> str:
        """Heuristic to guess the best data type for a column based on a sample."""
        sample = series.dropna().head(100)
        if sample.empty:
            return "string"

        # Check for Datetime
        try:
            pd.to_datetime(sample, errors='raise')
            return "date"
        except (ValueError, TypeError):
            pass

        # Check for Numeric
        try:
            num_sample = pd.to_numeric(sample, errors='raise')
            # If all numbers are whole (e.g., 1.0, 2.0), suggest int
            if np.isclose(num_sample % 1, 0).all():
                return "int"
            return "float"
        except (ValueError, TypeError):
            pass

        return "string"
