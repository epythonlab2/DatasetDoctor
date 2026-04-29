# analysis/cleaning_plugins/executor.py

import pandas as pd
from typing import List, Tuple, Dict, Any, Optional
from datasetdoctor.core.logger import logger
from .registry import REGISTRY


class CleaningExecutor:
    """
    Orchestrates the sequential execution of cleaning plugins.

    This class manages a copy of a DataFrame and applies a series of plugins 
    defined in the REGISTRY, collecting audit metadata and handling errors 
    at each step to ensure pipeline stability.

    Attributes:
        df (pd.DataFrame): The current state of the data being cleaned.
        clean_report (Dict[str, Any]): A collection of metadata and stats 
            from each executed plugin.
    """

    def __init__(self, df: pd.DataFrame):
        """
        Initializes the executor with a copy of the input data.

        Args:
            df (pd.DataFrame): The raw input data.
        """
        self.df = df.copy()
        self.clean_report: Dict[str, Any] = {}

    def run(
        self, 
        plugin_names: List[str], 
        params: Optional[Dict[str, Any]] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Runs a sequence of plugins against the stored DataFrame.

        Args:
            plugin_names (List[str]): Ordered list of plugin names to execute.
            params (Optional[Dict[str, Any]]): Configuration for each plugin, 
                keyed by plugin name. Defaults to None.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: A tuple containing:
                - The final processed pd.DataFrame.
                - The full cleaning report/audit log.
        """
        plugin_params = params or {}
        
        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)
            
            if not plugin_cls:
                logger.error(f"Executor: Plugin '{name}' not found in registry. Skipping.")
                self.clean_report[name] = {"status": "skipped", "error": "Not found in registry"}
                continue

            try:
                # Instantiate and extract specific arguments for this plugin
                plugin = plugin_cls()
                plugin_args = plugin_params.get(name, {})

                logger.debug(f"Executor: Starting execution of '{name}'...")
                
                # 1. Execute the plugin logic
                new_df, stats = plugin.run(self.df, **plugin_args)
                
                # 2. Update internal state only if the plugin reports success
                if "error" not in stats:
                    self.df = new_df
                    logger.info(f"Executor: Plugin '{name}' applied successfully.")
                    stats["status"] = "success"
                else:
                    logger.warning(
                        f"Executor: Plugin '{name}' returned an internal error. "
                        f"Data not updated. Error: {stats['error']}"
                    )
                    stats["status"] = "warning"
                
                # 3. Log metadata to report
                self.clean_report[name] = stats

            except Exception as e:
                logger.error(f"Executor: Critical failure on plugin '{name}': {e}", exc_info=True)
                self.clean_report[name] = {
                    "status": "failed", 
                    "error": str(e)
                }
                
        return self.df, self.clean_report
