# analysis/cleaning_plugins/drop_columns.py
import logging
from typing import Tuple, Dict, Any, List
import pandas as pd

from .base import CleaningPlugin
from .registry import register_cleaning

logger = logging.getLogger(__name__)

@register_cleaning
class DropColumnsPlugin(CleaningPlugin):
    """
    Destructive cleaning plugin to remove specific features from a dataset.
    Ensures the 'drop' action is idempotent by validating column existence.
    """
    name = "drop_columns"

    def run(
        self, 
        df: pd.DataFrame, 
        columns_to_drop: List[str] = None, 
        **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the column removal process.
        
        :param df: Input pandas DataFrame.
        :param columns_to_drop: List of original column strings to remove.
        :return: (Cleaned DataFrame, Audit Metadata)
        """
        requested = columns_to_drop or []
        
        # Validate columns exist to prevent KeyError
        valid_cols = [col for col in requested if col in df.columns]
        
        if not valid_cols:
            logger.info("DropColumnsPlugin: No valid columns found to drop.")
            return df, {"dropped": []}

        # Perform the drop
        df_cleaned = df.drop(columns=valid_cols)
        
        logger.info(f"DropColumnsPlugin: Successfully dropped {len(valid_cols)} columns.")
        
        return df_cleaned, {
            "dropped": valid_cols,
            "count": len(valid_cols)
        }
