# analysis/cleaning_plugins/executor.py
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from datasetdoctor.core.logger import logger

from .registry import REGISTRY


class CleaningExecutor:
    """
    Orchestrates the sequential execution of cleaning plugins on a DataFrame.

    This class maintains the state of the DataFrame throughout the cleaning
    pipeline and compiles an audit report of all changes and errors encountered
    during the process.
    """

    def __init__(self, df: pd.DataFrame):
        """
        Initializes the executor with a copy of the target dataset.

        Args:
            df: The initial pandas DataFrame to be cleaned.
        """
        self.df = df.copy()
        self.clean_report: Dict[str, Any] = {}

    def run(
        self, plugin_names: List[str], params: Optional[Dict[str, Any]] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Sequentially runs the specified plugins.

        Args:
            plugin_names: A list of plugin identifiers (e.g., ['remove_duplicates']).
            params: A dictionary where keys are plugin names and values are
                the keyword arguments for that plugin's `run` method.

        Returns:
            A tuple of (final_df, full_audit_report).
        """
        params = params or {}

        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)

            if not plugin_cls:
                logger.warning(
                    f"Executor: Plugin '{name}' not found in registry. Skipping."
                )
                continue

            try:
                # Instantiate and extract specific arguments for this plugin
                plugin = plugin_cls()
                plugin_args = params.get(name, {})

                # Execute the plugin logic
                new_df, stats = plugin.run(self.df, **plugin_args)

                # Update the state only if no logical error was reported
                if "error" not in stats:
                    self.df = new_df
                    logger.info(f"Executor: Plugin '{name}' applied successfully.")
                else:
                    logger.warning(
                        f"Executor: Plugin '{name}' reported an error. "
                        f"State preserved. Error: {stats['error']}"
                    )

                # Record results in the audit report
                self.clean_report[name] = stats

            except Exception as e:
                logger.error(f"Executor: Critical failure on plugin '{name}': {e}")
                self.clean_report[name] = {
                    "status": "failed",
                    "error": str(e),
                    "success": False,
                }

        return self.df, self.clean_report
