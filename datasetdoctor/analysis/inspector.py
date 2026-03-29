from typing import Any, Dict

import pandas as pd

from datasetdoctor.analysis.analyzer import (
    data_quality_score,
    detect_imbalance,
    detect_outliers,
    generate_suggestions,
    ml_readiness,
    summary_statistics,
)


def _safe(func, *args, default=None, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception:
        return default


def _infer_type(series: pd.Series) -> str:
    return str(series.dtype)


def analyze_dataset(file_path: str, target: str | None = None) -> Dict[str, Any]:
    """
    Orchestrates the dataset analysis using a chunked, profile-driven approach
    to handle large files without excessive memory consumption.
    """
    CHUNK_SIZE = 100_000

    # --- Phase 1: Streaming Profile Generation ---
    # We scan the file once to get global aggregates
    reader = pd.read_csv(file_path, chunksize=CHUNK_SIZE)

    total_rows = 0
    missing_counts = None
    any_duplicates = False
    first_chunk = None

    for i, chunk in enumerate(reader):
        if chunk.empty:
            continue

        if i == 0:
            first_chunk = chunk
            missing_counts = pd.Series(0, index=chunk.columns)

        total_rows += len(chunk)
        missing_counts += chunk.isna().sum()

        if not any_duplicates:
            any_duplicates = chunk.duplicated().any()

    if first_chunk is None:
        raise ValueError("Dataset is empty or could not be read.")

    # --- Phase 2: Create the Profile Object ---
    # This object is passed to all sub-functions to prevent re-scanning
    profile = {
        "rows": total_rows,
        "cols": len(first_chunk.columns),
        "missing_counts": missing_counts,
        "nunique": first_chunk.nunique(
            dropna=True
        ),  # Note: n-unique is based on sample/first chunk for speed
        "dtypes": first_chunk.dtypes,
        "any_duplicates": any_duplicates,
    }

    # Use the first chunk as the representative DataFrame for distribution-based metrics
    df = first_chunk
    feature_df = df.drop(columns=[target]) if target and target in df.columns else df

    # --- Phase 3: Run Analysis Functions ---

    # 1. Summary Metrics
    total_cells = profile["rows"] * profile["cols"]
    missing_percent = (
        round((missing_counts.sum() / total_cells * 100), 2) if total_cells else 0
    )
    # Duplicate % is estimated from the first chunk if total rows are massive
    dup_sample = df.duplicated().sum() if any_duplicates else 0
    duplicates_percent = round((dup_sample / len(df)) * 100, 2)

    summary = {
        "rows": profile["rows"],
        "cols": profile["cols"],
        "missingPercent": missing_percent,
        "duplicatesPercent": duplicates_percent,
        "quality_score": _safe(data_quality_score, df, profile),
        "ml_readiness": _safe(ml_readiness, df, profile, target=target),
    }

    # 2. Statistics & Outliers
    stats_df = _safe(summary_statistics, df)
    stats_dict = (
        stats_df.where(pd.notnull(stats_df), None).to_dict(orient="index")
        if stats_df is not None
        else {}
    )

    outliers = {}
    numeric_df = feature_df.select_dtypes(include="number")
    if not numeric_df.empty:
        outliers = _safe(detect_outliers, numeric_df, default={})

    # 3. Imbalance & Suggestions
    imbalance = _safe(detect_imbalance, df, target) if target else {}
    suggestions = _safe(generate_suggestions, feature_df, profile, default=[])

    # 4. Column-level Stats (Vectorized lookup)
    column_stats = []
    for col in df.columns:
        column_stats.append(
            {
                "name": col,
                "type": _infer_type(df[col]),
                "missingPercent": round((missing_counts[col] / total_rows) * 100, 2),
                "unique": int(profile["nunique"].get(col, 0)),
            }
        )

    return {
        "summary": summary,
        "columns": column_stats,
        "statistics": stats_dict,
        "outliers": outliers,
        "imbalance": imbalance,
        "suggestions": suggestions,
    }
