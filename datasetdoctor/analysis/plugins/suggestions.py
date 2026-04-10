from .base import AnalysisPlugin
from .registry import register_plugin

@register_plugin
class SuggestionsPlugin(AnalysisPlugin):
    """
    Analyzes dataset profiles to provide data cleaning and 
    feature engineering recommendations.
    """
    name = "suggestions"
    MISSING_THRESHOLD = 0.3

    def run(self, df, target=None, profile=None, context=None):
        """
        Generates suggestions based on missingness, cardinality, and naming conventions.
        
        :param df: The input pandas DataFrame.
        :param profile: Dictionary containing 'rows', 'nunique', and 'missing_counts'.
        :return: Dict containing a list of suggestion strings.
        """
        if not profile or "rows" not in profile:
            return {"value": []}

        suggestions = []
        rows = profile["rows"]
        
        # Pull thresholds from context if available, otherwise use default
        missing_limit = context.get("missing_threshold", self.MISSING_THRESHOLD) if context else self.MISSING_THRESHOLD

        for col in df.columns:
            nunique = profile.get("nunique", {}).get(col, 0)
            missing_count = profile.get("missing_counts", {}).get(col, 0)
            missing_ratio = missing_count / rows if rows > 0 else 0

            # 1. High Nullity Check
            if missing_ratio > missing_limit:
                suggestions.append(
                    f"{col}: high missing ({missing_ratio:.2%}) → impute or drop"
                )

            # 2. Zero Variance Check
            if nunique <= 1:
                suggestions.append(f"{col}: constant value detected → drop column")

            # 3. Temporal Feature Heuristic
            if "date" in col.lower() or "time" in col.lower():
                suggestions.append(f"{col}: potential datetime → extract temporal features")

        return {"value": suggestions}
