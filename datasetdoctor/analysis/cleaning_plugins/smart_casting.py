from datasetdoctor.core.logger import logger
from typing import Tuple, Dict, Any, Optional
import pandas as pd
import numpy as np

from .base import CleaningPlugin
from .registry import register_cleaning

@register_cleaning
class SmartCastPlugin(CleaningPlugin):
    # CRITICAL: This must match the 'action' and 'plugin_params' key in your background task
    name = "cast_schema"

    def run(
        self, 
        df: pd.DataFrame, 
        target_column: str, 
        method: str = "auto", 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        
        if target_column not in df.columns:
            return df, {"error": f"Column '{target_column}' not found."}

        # Work on a copy to ensure the Executor receives a fresh state
        df_cleaned = df.copy()
        initial_dtype = str(df_cleaned[target_column].dtype)
        
        # Strategy selection
        target_type = method
        if method == "auto":
            target_type = self._determine_target_type(df_cleaned[target_column])

        logger.info(f"Cast attempt on '{target_column}': {initial_dtype} -> {target_type}")

        try:
            if target_type in ["date", "datetime"]:
                df_cleaned[target_column] = pd.to_datetime(df_cleaned[target_column], errors='coerce')
            
            elif target_type in ["float", "numeric"]:
                # We use .astype(float) to force 'int64' to 'float64' even if no decimals exist
                df_cleaned[target_column] = pd.to_numeric(df_cleaned[target_column], errors='coerce').astype(float)
            
            elif target_type in ["int", "integer"]:
                # Use nullable Int64 to prevent conversion to float if NaNs are present
                df_cleaned[target_column] = pd.to_numeric(df_cleaned[target_column], errors='coerce').round().astype("Int64")
            
            elif target_type in ["bool", "boolean"]:
                bool_map = {
                    'true': True, 'false': False, 
                    '1': True, '0': False, 
                    1: True, 0: False,
                    True: True, False: False
                }
            
                # Standardize to string for mapping, then cast to nullable boolean
                df_cleaned[target_column] = df_cleaned[target_column].astype(str).str.lower().map(bool_map).astype("boolean")
            
            elif target_type == "encode":
                col = target_column  # enforce consistency

                # 1. Clean values (DO NOT blindly cast to string)
                series = df_cleaned[col]

                # 2. Get unique categories safely
                unique_vals = sorted(series.dropna().unique())

                # 3. Create mapping for ALL cases (not just binary)
                mapping = {val: idx for idx, val in enumerate(unique_vals)}

                # 4. Apply mapping
                encoded = series.map(mapping)

                # 5. Validate: detect unmapped values
                if encoded.isna().any():
                    missing = series[encoded.isna()].unique()
                    raise ValueError(f"Unmapped values found: {missing}")

                # 6. Enforce integer type
                df_cleaned[col] = encoded.astype("int64")
                            

            else:
                return df, {"error": f"Unsupported target type: {target_type}"}

        except Exception as e:
            logger.error(f"Cast failed for '{target_column}': {str(e)}")
            # Return original df so the Executor knows this specific step failed
            return df, {"error": f"Conversion failed: {str(e)}", "column": target_column}

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
        """Heuristic to guess the best data type for a column."""
        sample = series.dropna().head(100)
        if sample.empty:
            return "string"

        # Check for Datetime
        try:
            pd.to_datetime(sample, errors='raise')
            return "date"
        except:
            pass

        # Check for Numeric
        try:
            num_sample = pd.to_numeric(sample, errors='raise')
            # If all numbers are whole, suggest int, otherwise float
            if np.isclose(num_sample % 1, 0).all():
                return "int"
            return "float"
        except:
            pass

        return "string"
