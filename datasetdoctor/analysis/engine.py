# analysis/engine.py
# analysis/engine.py
from typing import Any, Dict

import pandas as pd

from .inspect import DatasetInspector


def analyze_dataset(file_path: str, target: str | None = None) -> Dict[str, Any]:
    df = pd.read_csv(file_path)

    if df.empty:
        raise ValueError("Dataset is empty or unreadable.")

    inspector = DatasetInspector(df)
    results = inspector.run(target=target)

    # -------------------------
    # Summary (keep stable + predictable)
    # -------------------------
    total_cells = df.size

    missing_percent = (
        round(df.isna().sum().sum() / total_cells * 100, 2) if total_cells else 0
    )

    duplicates_percent = round(df.duplicated().mean() * 100, 2) if len(df) else 0

    summary = {
        "rows": len(df),
        "cols": len(df.columns),
        "missingPercent": missing_percent,
        "duplicatesPercent": duplicates_percent,
        "quality_score": results.get("data_quality", {}).get("score", 0),
        "ml_readiness": results.get("ml_readiness", 0),
    }

    # -------------------------
    # Columns (ensure consistency)
    # -------------------------
    columns = results.get("statistics", {}).get("columns", [])
    if not columns:
        columns = [
            {
                "name": col,
                "type": str(df[col].dtype),
                "missing": int(df[col].isna().sum()),
                "unique": int(df[col].nunique()),
            }
            for col in df.columns
        ]

    # -------------------------
    # Statistics (ensure old frontend compatibility)
    # -------------------------
    statistics = results.get("statistics", {})

    # -------------------------
    # Final structure (same contract as before)
    # -------------------------
    return {
        "summary": summary,
        "columns": columns,
        "statistics": statistics,
        "leakage": results.get("data_leakage", {}),
        "outliers": results.get("outliers", {}),
        "imbalance": results.get("imbalance", {}),
        "suggestions": results.get("suggestions", {}).get("suggestions", []),
    }
