from typing import Any, Dict, Optional
import pandas as pd
import numpy as np
from .base import AnalysisPlugin
from .registry import register_plugin

@register_plugin
class OutliersPlugin(AnalysisPlugin):
    """
    Detects outliers in numeric columns using the Interquartile Range (IQR) method.
    
    This plugin calculates the 'Tukey's Fences' at 1.5 * IQR below the first 
    quartile and above the third quartile.
    """

    name: str = "outliers"

    def run(
        self, 
        df: pd.DataFrame, 
        target: Optional[str] = None, 
        profile: Optional[Dict[str, Any]] = None, 
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Identifies outlier counts and ratios for all numeric columns.
        
        Args:
            df: The input DataFrame.
            target: Ignored by this plugin.
            profile: Ignored by this plugin.
            context: Ignored by this plugin.

        Returns:
            A dictionary keyed by column name, containing:
                - count: Total number of outliers detected.
                - ratio: Proportion of outliers relative to total rows.
        """
        # 1. Isolate numeric data
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty:
            return {}

        # 2. Calculate Quartiles and IQR
        # Quantile calculation can be expensive; we do it once for the whole DF.
        q_df = numeric_df.quantile([0.25, 0.75])
        q1 = q_df.loc[0.25]
        q3 = q_df.loc[0.75]
        iqr = q3 - q1

        # 3. Filter for columns with variance (IQR > 0)
        # Columns with IQR = 0 (constant values) would result in every 
        # non-constant value being flagged as an outlier.
        valid_cols = iqr[iqr > 0].index
        
        if valid_cols.empty:
            return {}

        results = {}
        total_rows = len(df)

        # 4. Vectorized Outlier Detection
        for col in valid_cols:
            lower_bound = q1[col] - 1.5 * iqr[col]
            upper_bound = q3[col] + 1.5 * iqr[col]

            # Use bitwise OR for vectorized boolean indexing
            is_outlier = (numeric_df[col] < lower_bound) | (numeric_df[col] > upper_bound)
            count = int(is_outlier.sum())

            results[col] = {
                "count": count,
                "ratio": round(count / total_rows, 4) if total_rows > 0 else 0.0
            }

        return results
