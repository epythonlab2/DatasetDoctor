# analysis/cleaning_plugins/executor.py
import pandas as pd
from typing import List, Tuple, Dict, Any
from .registry import REGISTRY
from datasetdoctor.core.logger import logger

class CleaningExecutor:
    def __init__(self, df: pd.DataFrame):
        # We work on a copy to ensure the original raw DF stays intact 
        # until we are ready to save the final result.
        self.df = df.copy()
        self.surgery_report: Dict[str, Any] = {}

    def run(self, plugin_names: List[str]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Sequentially executes registered plugins on the internal DataFrame.
        """
        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)
            
            if not plugin_cls:
                logger.warning(f"Refine Engine: Plugin '{name}' not found in REGISTRY.")
                continue

            try:
                # Instantiate the plugin class (e.g., RemoveDuplicatesPlugin)
                plugin = plugin_cls()
                
                # Execute the 'run' method defined in base.py
                self.df, stats = plugin.run(self.df)
                
                # Store the stats (like 'duplicates_removed') for the final JSON
                self.surgery_report[name] = stats
                logger.info(f"Refine Engine: Successfully applied {name}")
                
            except Exception as e:
                logger.error(f"Refine Engine: Plugin {name} failed | {e}", exc_info=True)
                self.surgery_report[name] = {"status": "error", "message": str(e)}

        return self.df, self.surgery_report
