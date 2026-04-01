# analysis/plugins/__init__.py
from .registry import REGISTRY, register_plugin

from . import data_quality
from . import ml_readiness
from . import data_leakage
from . import outliers
from . import imbalance
from . import suggestions
from . import stats

__all__ = [
    "REGISTRY",
    "register_plugin",
]
