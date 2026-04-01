# analysis/plugins/data_quality.py
from .base import AnalysisPlugin
from .registry import register_plugin

@register_plugin
class DataQualityPlugin(AnalysisPlugin):
    name = "data_quality"

    def run(self, df, target=None, profile=None, context=None):
        if not profile: return {"score": 0.0}

        rows, cols = profile["rows"], profile["cols"]
        total_cells = rows * cols
        
        # Performance Engine: Reuse pre-computed missing counts
        missing = sum(profile["missing_counts"].values()) if isinstance(profile["missing_counts"], dict) else profile["missing_counts"].sum()
        duplicates = df.duplicated().sum() if profile.get("any_duplicates") else 0
        
        # Performance Engine: Reuse pre-computed nunique
        if isinstance(profile["nunique"], dict):
            constant_cols = sum(1 for v in profile["nunique"].values() if v <= 1)
        else:
            constant_cols = (profile["nunique"] <= 1).sum()

        m_ratio = missing / total_cells if total_cells > 0 else 0
        d_ratio = duplicates / rows if rows > 0 else 0
        c_ratio = constant_cols / cols if cols > 0 else 0

        score = 100.0 - (m_ratio * 40) - (d_ratio * 25) - (c_ratio * 20)
        return {
            "score": round(max(score, 0), 2),
            "ratios": {"missing": m_ratio, "duplicate": d_ratio, "constant": c_ratio}
        }
