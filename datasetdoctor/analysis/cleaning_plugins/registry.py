# analysis/cleaning_plugins/registry.py

from typing import Dict, Type
from .base import CleaningPlugin

# Global mapping of plugin names to their respective classes
REGISTRY: Dict[str, Type[CleaningPlugin]] = {}


def register_cleaning(cls: Type[CleaningPlugin]) -> Type[CleaningPlugin]:
    """
    Decorator to register a CleaningPlugin subclass in the global registry.

    This enables the CleaningExecutor to instantiate plugins by their 
    string name. The class must have a unique 'name' attribute defined.

    Args:
        cls (Type[CleaningPlugin]): The plugin class to register.

    Returns:
        Type[CleaningPlugin]: The registered class, allowing for decorator chaining.

    Raises:
        ValueError: If the plugin name is 'base', missing, or already registered.
    """
    # Ensure the plugin has a valid, non-default name
    plugin_name = getattr(cls, "name", None)
    
    if not plugin_name or plugin_name == "base":
        raise ValueError(
            f"Class '{cls.__name__}' must define a unique 'name' attribute "
            "to be registered (cannot be 'base')."
        )

    # Prevent accidental overwrites
    if plugin_name in REGISTRY:
        raise ValueError(
            f"Plugin name '{plugin_name}' is already registered by {REGISTRY[plugin_name]}. "
            f"Cannot register {cls} under the same name."
        )

    REGISTRY[plugin_name] = cls
    return cls
