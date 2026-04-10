from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Final

import pandas as pd


class AnalysisPlugin(ABC):
    """
    Abstract Base Class for dataset analysis plugins.
    
    Plugins are designed to be modular components that perform specific 
    statistical or structural analyses on a pandas DataFrame.
    """

    # Metadata - Should be defined in subclasses
    name: Final[str] = "base_plugin"
    depends_on: List[str] = []

    @abstractmethod
    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes the analysis logic.

        Args:
            df: The input DataFrame. Note: Implementation should treat 
                this as read-only to avoid side effects.
            target: The name of the target column for supervised tasks.
            profile: Pre-computed dataset statistics (e.g., dtypes, null counts)
                to avoid redundant calculations.
            context: Global configuration or shared state from the execution engine.

        Returns:
            A dictionary containing serializable analysis results.
            
        Raises:
            ValueError: If required columns or targets are missing.
            RuntimeError: If the analysis fails due to data inconsistencies.
        """
        pass

    def validate_inputs(self, df: pd.DataFrame, target: Optional[str]) -> None:
        """
        Optional hook for security and sanity checks. 
        Implementations should check for:
        1. Existence of target column.
        2. Minimum row requirements.
        3. Prevention of injection attacks via malicious column names.
        """
        if target and target not in df.columns:
            raise ValueError(f"Target column '{target}' not found in DataFrame.")
