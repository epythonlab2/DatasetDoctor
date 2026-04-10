# analysis/cleaning/clean_duplicate.py
from typing import Tuple, Dict, Any
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class RemoveDuplicatesPlugin(CleaningPlugin):
    name = "remove_duplicates"

    def run(self, df: pd.DataFrame, **kwargs):
        before = len(df)
        cleaned_df = df.drop_duplicates()
        removed = before - len(cleaned_df)

        # This dictionary is what 'meta.cleaning.remove_duplicates' sees in JS
        return cleaned_df, {
            "duplicates_removed": removed,
            "status": "optimized" if removed > 0 else "already_clean"
        }
