# analysis/plugins/executor.py
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
from .registry import REGISTRY
import pandas as pd

class PluginExecutor:
    def __init__(self, df: pd.DataFrame, profile: Optional[Dict[str, Any]] = None):
        self.df = df
        # If no profile is provided, we compute it once here
        self.profile = profile or self._internal_profile(df)
        self.results: Dict[str, Any] = {}

    def _internal_profile(self, df):
        # Fallback if streaming profile wasn't provided
        return {
            "rows": len(df),
            "cols": len(df.columns),
            "missing_counts": df.isna().sum().to_dict(),
            "nunique": df.nunique().to_dict(),
            "any_duplicates": bool(df.duplicated().any())
        }

    def _get_execution_order(self, plugin_names: List[str]) -> List[str]:
        graph = defaultdict(list)
        in_degree = {name: 0 for name in plugin_names}
        
        for name in plugin_names:
            plugin_cls = REGISTRY.get(name)
            if not plugin_cls: continue
            
            # Check dependencies
            deps = getattr(plugin_cls, 'depends_on', [])
            for dep in deps:
                if dep in in_degree:
                    graph[dep].append(name)
                    in_degree[name] += 1
                    
        queue = deque([n for n, d in in_degree.items() if d == 0])
        order = []
        while queue:
            curr = queue.popleft()
            order.append(curr)
            for neighbor in graph[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
        return order

    def run(self, plugin_names: List[str], target: Optional[str] = None) -> Dict[str, Any]:
        execution_order = self._get_execution_order(plugin_names)
        
        for name in execution_order:
            plugin_instance = REGISTRY[name]()
            try:
                # Pass df, target, the SHARED profile, and previous results (context)
                self.results[name] = plugin_instance.run(
                    self.df, 
                    target=target, 
                    profile=self.profile, 
                    context=self.results
                )
            except Exception as e:
                self.results[name] = {"error": str(e)}
                
        return self.results
