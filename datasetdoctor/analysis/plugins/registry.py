# analysis/plugins/registry.py
from typing import Dict, Type
from .base import AnalysisPlugin

REGISTRY: Dict[str, Type[AnalysisPlugin]] = {}


def register_plugin(plugin_cls: Type[AnalysisPlugin]):
    REGISTRY[plugin_cls.name] = plugin_cls
    return plugin_cls


def get_plugin(name: str) -> Type[AnalysisPlugin]:
    return REGISTRY[name]
