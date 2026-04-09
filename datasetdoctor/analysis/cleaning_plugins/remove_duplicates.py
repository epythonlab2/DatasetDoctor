# analysis/cleaning/clean_duplicate.py
from typing import Tuple, Dict, Any
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class RemoveDuplicatesPlugin(CleaningPlugin):
    name = "remove_duplicates"

    def run(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        before = len(df)

        cleaned_df = df.drop_duplicates()

        after = len(cleaned_df)

        removed = before - after

        return cleaned_df, {
            "rows_before": before,
            "rows_after": after,
            "duplicates_removed": removed,
            "reduction_ratio": round(removed / before, 4) if before else 0,
        }
