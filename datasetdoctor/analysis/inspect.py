from typing import Any, Dict, Optional
import pandas as pd

# Import the new architecture
from datasetdoctor.analysis.plugins.executor import PluginExecutor

def _infer_type(series: pd.Series) -> str:
    return str(series.dtype)

def analyze_dataset(file_path: str, target: str | None = None) -> Dict[str, Any]:
    """
    Orchestrates dataset analysis using a streaming profile-driven approach.
    Now leverages the PluginExecutor for modular, dependency-aware analysis.
    """
    CHUNK_SIZE = 100_000
    reader = pd.read_csv(file_path, chunksize=CHUNK_SIZE)

    total_rows = 0
    missing_counts = None
    any_duplicates = False
    first_chunk = None
    second_chunk = None

    # --- Phase 1: Streaming Profile Generation (Full File Scan) ---
    for i, chunk in enumerate(reader):
        if chunk.empty:
            continue

        if i == 0:
            first_chunk = chunk
            missing_counts = pd.Series(0, index=chunk.columns)
        elif i == 1:
            second_chunk = chunk

        total_rows += len(chunk)
        missing_counts += chunk.isna().sum()

        if not any_duplicates:
            any_duplicates = chunk.duplicated().any()

    if first_chunk is None:
        raise ValueError("Dataset is empty or could not be read.")

    # --- Phase 2: Create JSON-safe Profile (The Engine) ---
    # We convert Series to Dicts here so plugins don't have to deal with Pandas types
    profile = {
        "rows": total_rows,
        "cols": len(first_chunk.columns),
        "missing_counts": missing_counts.to_dict(),
        "nunique": first_chunk.nunique(dropna=True).to_dict(),
        "dtypes": first_chunk.dtypes.apply(str).to_dict(),
        "any_duplicates": bool(any_duplicates),
    }

    # --- Phase 3: Sampling Strategy ---
    # Combine first two chunks for a better statistical sample if available
    df_sample = first_chunk
    if second_chunk is not None:
        df_sample = pd.concat([first_chunk, second_chunk], ignore_index=True)

    # --- Phase 4: Plugin Execution ---
    executor = PluginExecutor(df_sample, profile=profile)
    
    # Order is managed by the executor's topological sort
    plugin_results = executor.run([
        "data_quality", 
        "ml_readiness", 
        "data_leakage", 
        "outliers", 
        "imbalance", 
        "suggestions", 
        "stats"
    ], target=target)

    # --- Phase 5: Build Legacy Output Structure ---
    
    # 1. Map Data Quality & ML Readiness to Summary
    dq_res = plugin_results.get("data_quality", {})
    ml_res = plugin_results.get("ml_readiness", {})
    
    total_cells = profile["rows"] * profile["cols"]
    global_missing_sum = sum(profile["missing_counts"].values())
    missing_percent = round((global_missing_sum / total_cells * 100), 2) if total_cells else 0

    summary = {
        "rows": profile["rows"],
        "cols": profile["cols"],
        "missingPercent": missing_percent,
        "duplicatesPercent": round((df_sample.duplicated().sum() / len(df_sample)) * 100, 2) if any_duplicates else 0,
        "quality_score": dq_res.get("score", 0),
        "ml_readiness": ml_res.get("value", 0),
    }

    # 2. Reconstruct Column-level Stats
    column_stats = []
    for col in first_chunk.columns:
        col_missing = profile["missing_counts"].get(col, 0)
        column_stats.append({
            "name": col,
            "type": _infer_type(df_sample[col]),
            "missingPercent": round((col_missing / total_rows) * 100, 2) if total_rows > 0 else 0,
            "unique": int(profile["nunique"].get(col, 0)),
        })

    # 3. Final Assembly
    return {
        "summary": summary,
        "columns": column_stats,
        "statistics": plugin_results.get("stats", {}),
        "outliers": plugin_results.get("outliers", {}),
        "imbalance": plugin_results.get("imbalance", {}),
        "leakage": plugin_results.get("data_leakage", {}),
        "suggestions": plugin_results.get("suggestions", {}).get("value", []),
    }
