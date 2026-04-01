# analysis/plugins/data_leakage.py
from .base import AnalysisPlugin
from .registry import register_plugin
import pandas as pd

@register_plugin
class DataLeakagePlugin(AnalysisPlugin):
    name = "data_leakage"

    def run(self, df, target=None, profile=None, context=None):
        if not target or target not in df.columns:
            return {"leakage_risk": "NONE", "details": "No target specified"}

        features = df.drop(columns=[target])
        numeric_features = features.select_dtypes(include="number")
        
        perfect_predictors = []
        high_correlation = []
        
        if not numeric_features.empty and pd.api.types.is_numeric_dtype(df[target]):
            correlations = numeric_features.corrwith(df[target]).abs()
            
            for col, val in correlations.items():
                if val >= 1.0:
                    perfect_predictors.append(col)
                elif val > 0.90:
                    high_correlation.append(col)

        # Detect duplicate columns (simple version)
        duplicate_columns = []
        # (Logic omitted for brevity, but you can add df.T.duplicated() here)

        risk_level = "HIGH" if perfect_predictors or len(high_correlation) > 2 else "LOW"
        if not perfect_predictors and not high_correlation:
            risk_level = "NONE"

        return {
            "leakage_risk": risk_level,
            "perfect_predictors": perfect_predictors,
            "high_correlation": high_correlation,
            "duplicate_columns": duplicate_columns
        }
