# analysis/plugins/ml_readiness.py
from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class MLReadinessPlugin(AnalysisPlugin):
    name = "ml_readiness"
    depends_on = ["data_quality", "imbalance"]

    def run(self, df, target=None, profile=None, context=None):
        context = context or {}
        dq_score = context.get("data_quality", {}).get("score", 0)

        score = 100
        rows, cols = profile["rows"], profile["cols"]

        # Calculate missing ratio from profile
        missing = (
            sum(profile["missing_counts"].values())
            if isinstance(profile["missing_counts"], dict)
            else profile["missing_counts"].sum()
        )
        if (missing / (rows * cols)) > 0.1:
            score -= 20
        if profile.get("any_duplicates"):
            score -= 10
        if cols < 3:
            score -= 15

        # Imbalance penalty from context
        if context.get("imbalance", {}).get("is_imbalanced"):
            score -= 10

        # Final score is a blend of data quality and readiness checks
        final_score = (score + dq_score) / 2
        return {"value": int(max(final_score, 0))}
