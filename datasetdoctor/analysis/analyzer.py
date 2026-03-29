from typing import Any, Dict, List, Optional

import pandas as pd


# -------------------------
# PERFORMANCE ENGINE
# -------------------------
def profile_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Computes expensive metrics in a single pass to be reused."""
    if df.empty:
        return {}

    return {
        "rows": len(df),
        "cols": len(df.columns),
        "missing_counts": df.isna().sum(),
        "nunique": df.nunique(dropna=True),
        "dtypes": df.dtypes,
        "any_duplicates": df.duplicated().any(),
    }


# -------------------------
# CORE METRICS
# -------------------------
def data_quality_score(
    df: pd.DataFrame, profile: Optional[Dict[str, Any]] = None
) -> float:
    # Fallback for original behavior if profile isn't passed
    if profile is None:
        profile = profile_dataframe(df)

    if not profile:
        return 0.0

    rows, cols = profile["rows"], profile["cols"]
    total_cells = rows * cols

    missing = profile["missing_counts"].sum()
    # duplicates Percent is calculated on the current DF view
    duplicates = df.duplicated().sum() if profile["any_duplicates"] else 0
    constant_cols = (profile["nunique"] <= 1).sum()

    missing_ratio = missing / total_cells if total_cells else 0
    duplicate_ratio = duplicates / rows if rows else 0
    constant_ratio = constant_cols / cols if cols else 0

    score = (
        100.0 - (missing_ratio * 40) - (duplicate_ratio * 25) - (constant_ratio * 20)
    )
    return round(max(score, 0), 2)


# -------------------------
# OUTLIERS
# -------------------------
def detect_outliers(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
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


# -------------------------
# IMBALANCE
# -------------------------
def detect_imbalance(df: pd.DataFrame, target: str) -> Dict[str, Any]:
    if target not in df.columns:
        return {}

    series = df[target]
    dist = series.value_counts(normalize=True, dropna=False)
    return {
        "distribution": {str(k): round(v, 4) for k, v in dist.items()},
        "is_imbalanced": bool(dist.max() > 0.8),
        "missing_ratio": round(series.isna().mean(), 4),
        "target_column": target,
    }


# -------------------------
# ML READINESS
# -------------------------
def ml_readiness(
    df: pd.DataFrame,
    profile: Optional[Dict[str, Any]] = None,
    target: Optional[str] = None,
) -> int:
    if profile is None:
        profile = profile_dataframe(df)

    if not profile:
        return 0

    score = 100
    total_cells = profile["rows"] * profile["cols"]
    missing_ratio = profile["missing_counts"].sum() / total_cells

    if missing_ratio > 0.1:
        score -= 20
    if profile["any_duplicates"]:
        score -= 10
    if profile["cols"] < 3:
        score -= 15

    features_nunique = (
        profile["nunique"].drop(labels=[target])
        if target in profile["nunique"]
        else profile["nunique"]
    )
    if (features_nunique <= 1).any():
        score -= 10

    if target and target in df.columns:
        dist = df[target].value_counts(normalize=True)
        if not dist.empty and dist.max() > 0.85:
            score -= 15

    return int(max(score, 0))


# -------------------------
# SUGGESTIONS
# -------------------------
def generate_suggestions(
    df: pd.DataFrame, profile: Optional[Dict[str, Any]] = None
) -> List[str]:
    if profile is None:
        profile = profile_dataframe(df)

    suggestions = []
    rows = profile["rows"]
    numeric_cols = profile["dtypes"][
        profile["dtypes"].apply(pd.api.types.is_numeric_dtype)
    ].index
    skews = df[numeric_cols].skew() if not numeric_cols.empty else pd.Series()

    for col in df.columns:
        nunique = profile["nunique"][col]
        missing_r = profile["missing_counts"][col] / rows
        dtype = profile["dtypes"][col]

        if missing_r > 0.3:
            suggestions.append(
                f"{col}: high missing ({missing_r:.2%}) → impute or drop"
            )
        if nunique <= 1:
            suggestions.append(f"{col}: constant → drop")
        if "date" in col.lower():
            suggestions.append(f"{col}: extract time features")
        if pd.api.types.is_object_dtype(dtype) or pd.api.types.is_categorical_dtype(
            dtype
        ):
            if nunique > 50:
                suggestions.append(f"{col}: high cardinality → encoding needed")
        if col in skews and abs(skews[col]) > 1:
            suggestions.append(f"{col}: skewed → transform")

    return suggestions


# -------------------------
# EXTRA UTILITIES (Fixes ImportError)
# -------------------------
def summary_statistics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    return df.describe(include="all").transpose()


def correlation_matrix(df: pd.DataFrame, method: str = "pearson") -> pd.DataFrame:
    numeric_df = df.select_dtypes(include="number")
    if numeric_df.empty or numeric_df.shape[1] < 2:
        return pd.DataFrame()
    return numeric_df.corr(method=method)
