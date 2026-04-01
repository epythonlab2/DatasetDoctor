# analysis/profiler.py
from typing import Any, Dict
import pandas as pd

def profile_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Computes expensive metrics in a single pass to be reused."""
    if df.empty:
        return {}

    return {
        "rows": int(len(df)),
        "cols": int(len(df.columns)),
        # Convert Series to dicts so plugins can use .get() safely
        "missing_counts": df.isna().sum().to_dict(),
        "nunique": df.nunique(dropna=True).to_dict(),
        "dtypes": df.dtypes.apply(str).to_dict(),
        "any_duplicates": bool(df.duplicated().any()),
    }
