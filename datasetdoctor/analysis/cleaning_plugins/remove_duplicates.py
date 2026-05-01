# analysis/cleaning_plugins/remove_duplicates.py
from typing import Any, Dict, Tuple

import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class RemoveDuplicatesPlugin(CleaningPlugin):
    """
    Plugin to identify and remove duplicate rows from a pandas DataFrame.

    This plugin compares rows and removes redundancies. It returns the cleaned
    DataFrame along with metadata detailing how many rows were removed and
     the operation status.
    """

    name = "remove_duplicates"

    def run(self, df: pd.DataFrame, **kwargs) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the duplicate removal logic.

        Args:
            df: The input DataFrame.
            **kwargs: Supports 'subset' (list of columns) and 'keep' ('first', 'last', False).

        Returns:
            A tuple containing the cleaned DataFrame and a metadata dictionary.
        """
        before_count = len(df)

        # subset and keep can be passed via kwargs to customize drop_duplicates
        subset = kwargs.get("subset", None)
        keep = kwargs.get("keep", "first")

        cleaned_df = df.drop_duplicates(subset=subset, keep=keep)
        removed_count = before_count - len(cleaned_df)

        meta = {
            "duplicates_removed": removed_count,
            "status": "optimized" if removed_count > 0 else "already_clean",
            "columns_affected": subset if subset else "all",
        }

        return cleaned_df, meta
