# analysis/plugins/auto_feature_selection.py

from typing import Dict, Any, List
import pandas as pd

from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class AutoFeatureSelectionPlugin(AnalysisPlugin):
    name = "auto_feature_selection"
    depends_on = ["predictive_power"]

    def run(self, df: pd.DataFrame, target=None, profile=None, context=None) -> Dict[str, Any]:
        results = context.get("results", {})
        pp_results = results.get("predictive_power", {})

        if not pp_results:
            return {
                "selected_features": [],
                "dropped_features": [],
                "reason": "No predictive power results found"
            }

        selected = []
        dropped = []
        explanations = {}

        for feature, info in pp_results.items():
            score = info.get("score", 0.0)
            stability = info.get("stability", 0.0)
            flags = info.get("flags", [])

            # ---- Selection Rules ----
            if "leakage_risk" in flags:
                dropped.append(feature)
                explanations[feature] = "Dropped: leakage risk detected"
                continue

            if score >= 0.3 and stability >= 0.6:
                selected.append(feature)
                explanations[feature] = "Selected: strong and stable"
            else:
                dropped.append(feature)
                explanations[feature] = (
                    f"Dropped: score={round(score, 3)}, "
                    f"stability={round(stability, 3)}"
                )

        return {
            "selected_features": selected,
            "dropped_features": dropped,
            "feature_explanations": explanations,
            "summary": {
                "total_features": len(pp_results),
                "selected": len(selected),
                "dropped": len(dropped)
            }
        }
