# analysis/plugins/__init__.py
"""
from . import (
    auto_feature_selection,
    data_leakage,
    data_quality,
    imbalance,
    ml_readiness,
    outliers,
    predictive_power,
    stats,
    suggestions,
)
"""

from .registry import REGISTRY, register_plugin

__all__ = [
    "REGISTRY",
    "register_plugin",
]
