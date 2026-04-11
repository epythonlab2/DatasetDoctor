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
        params = params or {}  # Ensure it's a dict even if None is passed
        
        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)
            if not plugin_cls:
                continue

            try:
                plugin = plugin_cls()
                
                # Get specific args for this plugin (e.g. columns_to_drop)
                # If no params exist for this plugin, it returns an empty dict {}
                plugin_args = params.get(name, {})

                # Execute with unpacking (**kwargs)
                self.df, stats = plugin.run(self.df, **plugin_args)
                
                self.clean_report[name] = stats
            except Exception as e:
                logger.error(f"Plugin {name} failed: {e}")
                # ... error handling ...
                self.clean_report[name] = {"status": "failed", "error": str(e)}
                
        return self.df, self.clean_report
