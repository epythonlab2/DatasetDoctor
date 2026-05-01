# analysis/cleaning_plugins/__init__.py

from . import drop_columns, remove_duplicates, smart_casting, smart_imputation
from .registry import REGISTRY, register_cleaning

__all__ = [
    "REGISTRY",
    "register_cleaning",
]
