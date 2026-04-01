# analysis/plugins/imbalance.py
from .base import AnalysisPlugin
from .registry import register_plugin

@register_plugin
class ImbalancePlugin(AnalysisPlugin):
    name = "imbalance"

    def run(self, df, target=None, profile=None, context=None):
        if not target or target not in df.columns: return {}

        series = df[target]
        dist = series.value_counts(normalize=True, dropna=False)
        return {
            "distribution": {str(k): round(v, 4) for k, v in dist.items()},
            "is_imbalanced": bool(dist.max() > 0.8),
            "missing_ratio": round(series.isna().mean(), 4),
            "target_column": target,
        }
