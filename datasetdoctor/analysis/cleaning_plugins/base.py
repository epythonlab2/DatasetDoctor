# analysis/cleaning_plugins/base.py
from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any
import pandas as pd


class CleaningPlugin(ABC):
    """
    Abstract base class for data cleaning plugins.

    All cleaning plugins should inherit from this class and implement the `run` method.
    Plugins are designed to take a DataFrame, perform specific transformations, 
    and return the modified DataFrame along with execution metadata.

    Attributes:
        name (str): A unique identifier for the plugin. Defaults to "base".
    """

    name: str = "base"

    @abstractmethod
    def run(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Executes the cleaning logic on the provided DataFrame.

        Args:
            df (pd.DataFrame): The raw or partially cleaned input data.

        Returns:
            Tuple[pd.DataFrame, Dict[str, Any]]: A tuple containing:
                - The processed pd.DataFrame.
                - A dictionary of metadata (e.g., rows removed, execution time, 
                  columns modified).
        """
        pass
