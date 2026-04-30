# analysis/cleaning_plugins/registry.py
from typing import Dict, Type
from .base import CleaningPlugin

# Global registry mapping plugin names to their respective classes
REGISTRY: Dict[str, Type[CleaningPlugin]] = {}


def register_cleaning(cls: Type[CleaningPlugin]) -> Type[CleaningPlugin]:
    """
    A decorator to register CleaningPlugin subclasses into the global REGISTRY.

    This function maps the plugin's `name` attribute to the class itself, 
    allowing for dynamic lookup and instantiation of cleaning strategies 
    at runtime.

    Args:
        cls (Type[CleaningPlugin]): The plugin class to register.

    Returns:
        Type[CleaningPlugin]: The same class, allowing for decorator chaining.

    Raises:
        ValueError: If the class does not have a 'name' attribute defined.
    """
    if not hasattr(cls, "name") or not cls.name:
        raise ValueError(f"Class {cls.__name__} must define a 'name' attribute to be registered.")
    
    REGISTRY[cls.name] = cls
    return cls
