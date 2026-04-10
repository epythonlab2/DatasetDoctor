# analysis/plugins/registry.py
from typing import Dict, Type
from .base import AnalysisPlugin


class PluginRegistryError(Exception):
    pass


REGISTRY: Dict[str, Type[AnalysisPlugin]] = {}


def register_plugin(plugin_cls: Type[AnalysisPlugin]):
    name = getattr(plugin_cls, "name", None)

    if not name or not isinstance(name, str):
        raise PluginRegistryError(
            f"Plugin {plugin_cls.__name__} must define a valid string 'name'"
        )

    if name in REGISTRY:
        raise PluginRegistryError(
            f"Duplicate plugin registration detected: '{name}' "
            f"already registered by {REGISTRY[name].__name__}"
        )

    REGISTRY[name] = plugin_cls
    return plugin_cls


def get_plugin(name: str) -> Type[AnalysisPlugin]:
    try:
        return REGISTRY[name]
    except KeyError as e:
        raise PluginRegistryError(f"Plugin not found: '{name}'") from e


def list_plugins() -> Dict[str, Type[AnalysisPlugin]]:
    return dict(REGISTRY)  # safe copy
