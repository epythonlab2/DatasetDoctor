# analysis/cleaning/clean_duplicate.py

from typing import Tuple, Dict, Any, List, Optional
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class RemoveDuplicatesPlugin(CleaningPlugin):
    """
    Cleaning plugin to identify and remove duplicate rows from the dataset.

    This plugin performs a full-row comparison. If any rows are identical 
    across all columns, only the first occurrence is kept.
    """

    name: str = "remove_duplicates"

    def run(
        self, 
        df: pd.DataFrame, 
        subset: Optional[List[str]] = None, 
        keep: str = "first",
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Removes duplicate rows from the DataFrame.

        Args:
            df (pd.DataFrame): The input pandas DataFrame.
            subset (List[str], optional): Only consider certain columns for 
                identifying duplicates. Defaults to None (all columns).
            keep (str): Determines which duplicates (if any) to keep. 
                Options: 'first', 'last', False. Defaults to 'first'.
            **kwargs: Additional arguments passed to pd.DataFrame.drop_duplicates.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: A tuple containing:
                - The de-duplicated pd.DataFrame.
                - Metadata including 'duplicates_removed' and a 'status' string.
        """
        initial_count = len(df)
        
        # Execute de-duplication
        df_cleaned = df.drop_duplicates(subset=subset, keep=keep)
        
        removed_count = initial_count - len(df_cleaned)

        # Generate audit metadata
        metadata = {
            "duplicates_removed": removed_count,
            "status": "optimized" if removed_count > 0 else "already_clean",
            "columns_checked": subset if subset else "all_columns"
        }

        return df_cleaned, metadata
