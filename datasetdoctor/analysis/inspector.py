# analysis/inspect.py
from typing import Any, Dict, Optional

import pandas as pd

from .plugins.executor import PluginExecutor


def _infer_type(series: pd.Series) -> str:
    """Returns the string representation of a pandas Series dtype."""
    return str(series.dtype)


def analyze_dataset(
    file_path: str, target: Optional[str] = None, filename: Optional[str] = None
):
    CHUNK_SIZE = 200_000
    MAX_SAMPLE_ROWS = 100_000
    
    reader = pd.read_csv(file_path, chunksize=CHUNK_SIZE, engine="c", low_memory=False)

    total_rows = 0
    missing_counts = None
    any_duplicates = False
    sample_collection = []
    rows_collected = 0

    # --- PHASE 1: Streaming Scan (Fast) ---
    for i, chunk in enumerate(reader):
        if chunk.empty: continue
        total_rows += len(chunk)
        
        # Track Missing Values
        if missing_counts is None:
            missing_counts = chunk.isna().sum()
        else:
            missing_counts += chunk.isna().sum()

        # Quick check for duplicates in the first few chunks
        if not any_duplicates and i < 5: 
            any_duplicates = chunk.duplicated().any()

        # Build the sample for plugins and redundancy check
        if rows_collected < MAX_SAMPLE_ROWS:
            take_n = min(len(chunk), MAX_SAMPLE_ROWS - rows_collected)
            sample_collection.append(chunk.iloc[:take_n])
            rows_collected += take_n

    df_sample = pd.concat(sample_collection, ignore_index=True)
    
    # --- PHASE 1 CALCULATIONS (For Top UI Row) ---
    num_cols = len(df_sample.columns)
    total_cells = total_rows * num_cols
    global_missing_pct = round((sum(missing_counts.values) / total_cells * 100), 2) if total_cells > 0 else 0
    
    # Calculate Redundancy (Duplicates) from the sample immediately
    sample_dupes = df_sample.duplicated().sum()
    redundancy_pct = round((sample_dupes / len(df_sample)) * 100, 2) if len(df_sample) > 0 else 0

    partial_output = {
        "filename": filename,
        "summary": {
            "rows": total_rows,
            "cols": num_cols,
            "missingPercent": global_missing_pct,
            "duplicatesPercent": redundancy_pct, # Shows Redundancy immediately
            "target_column": target,
        },
        "columns": [
            {
                "name": col,
                "type": str(df_sample[col].dtype),
                "missingPercent": round((missing_counts.get(col, 0) / total_rows) * 100, 2),
                "unique": int(df_sample[col].nunique()),
            } for col in df_sample.columns
        ],
    }

    # YIELD 1: UI updates Rows, Cols, Missing, Redundancy, and Table
    yield partial_output

    # --- PHASE 2: Deep Analysis (Slow) ---
    profile = {
        "rows": total_rows,
        "cols": num_cols,
        "missing_counts": missing_counts.to_dict(),
        "nunique": df_sample.nunique(dropna=True).to_dict(),
        "dtypes": df_sample.dtypes.apply(str).to_dict(),
        "any_duplicates": bool(any_duplicates or sample_dupes > 0),
    }

    executor = PluginExecutor(df_sample, profile=profile)
    plugin_results = executor.run([
        "data_quality", "ml_readiness", "data_leakage", 
        "outliers", "imbalance", "suggestions", "stats", "predictive_power"
    ], target=target)

    # FINAL ASSEMBLY
    full_output = {
        **partial_output,
        "predictive_power": plugin_results.get("predictive_power"),
        "statistics": plugin_results.get("stats", {}),
        "outliers": plugin_results.get("outliers", {}),
        "imbalance": plugin_results.get("imbalance", {}),
        "leakage": plugin_results.get("data_leakage", {}),
        "suggestions": plugin_results.get("suggestions", {}).get("value", []),
        "summary": {
            **partial_output["summary"],
            "quality_score": plugin_results.get("data_quality", {}).get("score", 0),
            "ml_readiness": plugin_results.get("ml_readiness", {}).get("value", 0),
        }
    }

    # YIELD 2: UI updates Health Metrics and AI Insights
    yield full_output
