# analysis/plugins/outliers.py
from .base import AnalysisPlugin
from .registry import register_plugin


@register_plugin
class OutliersPlugin(AnalysisPlugin):
    name = "outliers"

    def run(self, df, target=None, profile=None, context=None):
        numeric_df = df.select_dtypes(include="number")
        if numeric_df.empty:
            return {}

        q_df = numeric_df.quantile([0.25, 0.75])
        iqr = q_df.loc[0.75] - q_df.loc[0.25]
        valid_cols = iqr[iqr > 0].index

        results = {}
        for col in valid_cols:
            lower = q_df.loc[0.25, col] - 1.5 * iqr[col]
            upper = q_df.loc[0.75, col] + 1.5 * iqr[col]
            count = ((numeric_df[col] < lower) | (numeric_df[col] > upper)).sum()
            results[col] = {"count": int(count), "ratio": round(count / len(df), 4)}
        return results
