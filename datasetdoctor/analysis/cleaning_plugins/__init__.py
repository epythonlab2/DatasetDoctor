# analysis/cleaning_plugins/__init__.py

from . import (
   remove_duplicates
)

from .registry import REGISTRY, register_cleaning

__all__ = [
    "REGISTRY",
    "register_cleaning",
]
