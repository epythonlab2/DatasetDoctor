# analysis/plugins/stats.py
from typing import Any, Dict, Optional
import pandas as pd
import numpy as np
from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class StatsPlugin(AnalysisPlugin):
    """
    Computes comprehensive descriptive statistics for all column types.
    
    Automatically handles numeric, categorical, and datetime objects, 
    ensuring results are JSON-serializable by converting NumPy types to 
    Python natives and handling Null/NaN values.
    """

    name: str = "stats"

    def run(
        self, 
        df: pd.DataFrame, 
        target: Optional[str] = None, 
        profile: Optional[Dict[str, Any]] = None, 
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generates a statistical summary of the dataset.

        Args:
            df: The input DataFrame to analyze.
            target: Optional target variable (unused in base stats).
            profile: Optional pre-computed profile (unused).
            context: Execution context for optional configuration.

        Returns:
            A nested dictionary where keys are column names and values 
            are their respective statistical metrics.
        """
        if df.empty:
            return {}

        # 1. Generate descriptive statistics
        # include="all" ensures we don't skip non-numeric columns
        stats_df = df.describe(include="all").transpose()

        # 2. Performance & Data Integrity: Add inferred dtypes
        # Knowing the dtype helps the frontend render the data correctly
        stats_df["dtype"] = df.dtypes.astype(str)

        # 3. Clean for JSON Serialization
        # - replace(np.nan, None): standardizes nulls for JSON 'null'
        # - to_dict(orient="index"): creates {col_name: {metric: value}}
        # - Using 'replace' is often safer/faster than 'where' for full DFs
        raw_stats = stats_df.replace({np.nan: None}).to_dict(orient="index")

        # 4. Deep Clean NumPy types
        # pandas.describe often returns numpy.int64 or numpy.float64
        # which can break standard json.dumps()
        return self._sanitize_dict(raw_stats)

    def _sanitize_dict(self, data: Any) -> Any:
        """Recursively converts NumPy types to native Python types."""
        if isinstance(data, dict):
            return {k: self._sanitize_dict(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_dict(i) for i in data]
        elif isinstance(data, (np.integer, np.floating)):
            return data.item()
        elif isinstance(data, (np.ndarray, pd.Series)):
            return data.tolist()
        return data
