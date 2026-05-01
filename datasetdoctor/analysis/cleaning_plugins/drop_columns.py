# analysis/cleaning_plugins/drop_columns.py
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from datasetdoctor.core.logger import logger

from .base import CleaningPlugin
from .registry import register_cleaning


@register_cleaning
class DropColumnsPlugin(CleaningPlugin):
    """
    A destructive cleaning plugin that removes specified columns from a dataset.

    This plugin ensures idempotency by verifying column existence before
    attempting the drop operation, preventing errors if a column has already
    been removed or is missing.
    """

    name = "drop_columns"

    def run(
        self, df: pd.DataFrame, columns_to_drop: Optional[List[str]] = None, **kwargs
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the column removal process.

        Args:
            df: The input pandas DataFrame.
            columns_to_drop: A list of column names to be removed.
                Defaults to None.
            **kwargs: Additional keyword arguments (ignored).

        Returns:
            A tuple containing:
                - df_cleaned (pd.DataFrame): The DataFrame without the specified columns.
                - metadata (dict): Audit trail containing 'dropped' list and 'count'.
        """
        requested = columns_to_drop or []

        # Filter for columns that actually exist in the DataFrame
        valid_cols = [col for col in requested if col in df.columns]

        if not valid_cols:
            logger.info(f"{self.__class__.__name__}: No valid columns found to drop.")
            return df, {"dropped": [], "count": 0}

        # Perform the drop operation
        df_cleaned = df.drop(columns=valid_cols)

        logger.info(
            f"{self.__class__.__name__}: Successfully dropped {len(valid_cols)} columns: {valid_cols}"
        )

        return df_cleaned, {"dropped": valid_cols, "count": len(valid_cols)}
