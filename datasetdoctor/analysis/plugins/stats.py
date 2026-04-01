# analysis/plugins/stats.py
from .base import AnalysisPlugin
from .registry import register_plugin
import pandas as pd

@register_plugin
class StatsPlugin(AnalysisPlugin):
    name = "stats"

    def run(self, df, target=None, profile=None, context=None):
        if df.empty:
            return {}
            
        # Compute standard pandas describe
        stats_df = df.describe(include="all").transpose()
        
        # Replace NaN with None for JSON compliance
        stats_dict = stats_df.where(pd.notnull(stats_df), None).to_dict(orient="index")
        
        return stats_dict
