# analysis/cleaning_plugins/executor.py
import pandas as pd
from typing import List, Tuple, Dict, Any
from .registry import REGISTRY
from datasetdoctor.core.logger import logger

class CleaningExecutor:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.clean_report: Dict[str, Any] = {}

    def run(self, plugin_names: List[str], params: Dict[str, Any] = None) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        params = params or {}
        
        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)
            if not plugin_cls:
                continue

            try:
                plugin = plugin_cls()
                plugin_args = params.get(name, {})

                # 1. Execute
                new_df, stats = plugin.run(self.df, **plugin_args)
                
                # 2. Only update self.df if the plugin didn't explicitly return an error
                if "error" not in stats:
                    self.df = new_df
                    logger.info(f"Plugin {name} updated the dataframe successfully.")
                else:
                    logger.warning(f"Plugin {name} returned an error, df not updated: {stats['error']}")
                
                # 3. Append stats (using a list if you want history, or just updating key)
                self.clean_report[name] = stats

            except Exception as e:
                logger.error(f"Executor crash on plugin {name}: {e}")
                self.clean_report[name] = {"status": "failed", "error": str(e)}
                
        return self.df, self.clean_report
