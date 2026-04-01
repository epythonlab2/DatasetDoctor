# analysis/plugins/suggestions.py
from .base import AnalysisPlugin
from .registry import register_plugin

@register_plugin
class SuggestionsPlugin(AnalysisPlugin):
    name = "suggestions"

    def run(self, df, target=None, profile=None, context=None):
        if not profile: return []
        suggestions = []
        rows = profile["rows"]

        for col in df.columns:
            nunique = profile["nunique"].get(col, 0)
            missing_r = profile["missing_counts"].get(col, 0) / rows
            dtype = str(df[col].dtype)

            if missing_r > 0.3:
                suggestions.append(f"{col}: high missing ({missing_r:.2%}) → impute or drop")
            if nunique <= 1:
                suggestions.append(f"{col}: constant → drop")
            if "date" in col.lower():
                suggestions.append(f"{col}: extract time features")
            
        return {"value": suggestions}
