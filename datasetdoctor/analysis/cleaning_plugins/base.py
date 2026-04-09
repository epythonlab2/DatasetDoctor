# analysis/cleaning_plugins/base.py

from abc import ABC, abstractmethod
from typing import Tuple, Dict, Any
import pandas as pd


class CleaningPlugin(ABC):
    name: str = "base"

    @abstractmethod
    def run(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        pass
