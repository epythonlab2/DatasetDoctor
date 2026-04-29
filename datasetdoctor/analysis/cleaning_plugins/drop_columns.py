# analysis/cleaning_plugins/drop_columns.py

from typing import Tuple, Dict, Any, List, Optional
import pandas as pd

from datasetdoctor.core.logger import logger
from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class DropColumnsPlugin(CleaningPlugin):
    """
    Destructive cleaning plugin to remove specific features from a dataset.

    This plugin ensures the 'drop' action is idempotent by validating 
    column existence before attempting removal, preventing runtime errors.
    """

    name: str = "drop_columns"

    def run(
        self, 
        df: pd.DataFrame, 
        columns_to_drop: Optional[List[str]] = None, 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the column removal process.

        Args:
            df (pd.DataFrame): The input pandas DataFrame.
            columns_to_drop (List[str], optional): List of column names to remove. 
                Defaults to None.
            **kwargs: Additional arguments for future-proofing.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: A tuple containing:
                - The DataFrame with specified columns removed.
                - Metadata including 'dropped' (list of names) and 'count'.
        """
        requested = columns_to_drop or []
        
        # Identify columns that actually exist in the DataFrame
        existing_cols = [col for col in requested if col in df.columns]
        missing_cols = list(set(requested) - set(existing_cols))

        if missing_cols:
            logger.warning(
                f"{self.name.title()}: Requested columns not found in DataFrame: {missing_cols}"
            )

        if not existing_cols:
            logger.info(f"{self.name.title()}: No valid columns found to drop.")
            return df, {"dropped": [], "count": 0}

        # Perform the drop operation
        df_cleaned = df.drop(columns=existing_cols)
        
        logger.info(f"{self.name.title()}: Successfully dropped {len(existing_cols)} columns.")
        
        return df_cleaned, {
            "dropped": existing_cols,
            "count": len(existing_cols)
        }
