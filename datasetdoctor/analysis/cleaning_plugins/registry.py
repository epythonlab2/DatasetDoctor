# analysis/cleaning_plugins/registry.py
from typing import Dict, Type
from .base import CleaningPlugin

# Rename this from CLEANING_REGISTRY to REGISTRY
REGISTRY: Dict[str, Type[CleaningPlugin]] = {}


def register_cleaning(cls: Type[CleaningPlugin]):
    REGISTRY[cls.name] = cls
    return cls
