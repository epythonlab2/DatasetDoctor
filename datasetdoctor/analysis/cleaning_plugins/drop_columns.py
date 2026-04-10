# analysis/cleaning_plugins/drop_columns.py
from typing import Tuple, Dict, Any, List
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class DropColumnsPlugin(CleaningPlugin):
    name = "drop_columns" # <--- Use this specific string

    def run(self, df: pd.DataFrame, columns_to_drop: list = None, **kwargs) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        valid_cols = [c for c in (columns_to_drop or []) if c in df.columns]
        df_cleaned = df.drop(columns=valid_cols)
        return df_cleaned, {"dropped": valid_cols}
