# analysis/plugins/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, List
import pandas as pd


class AnalysisPlugin(ABC):
    """
    Base class for all dataset analysis plugins
    """

    name: str = "base"
    depends_on: List[str] = []

    @abstractmethod
    def run(
        self,
        df: pd.DataFrame,
        target: Optional[str] = None,
        profile: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        pass
