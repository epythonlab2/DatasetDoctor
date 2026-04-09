# analysis/cleaning/remove_duplicates.py
from typing import Tuple, Dict, Any
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class RemoveDuplicates(CleaningPlugin):
    name = "remove_duplicates"

    def run(self, df: pd.DataFrame):
        before = len(df)

        df_cleaned = df.drop_duplicates()

        after = len(df_cleaned)

        return df_cleaned, {
            "rows_before": before,
            "rows_after": after,
            "removed": before - after,
        }
