import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any
from .cleaning_plugins.executor import CleaningExecutor

def clean_dataset(
    raw_path: str, 
    clean_path: str, 
    plugins: list = ["remove_duplicates", "smart_impute"], 
    plugin_params: dict = None  # <--- ADD THIS PARAMETER
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Standalone Cleaning Engine.
    """
    # 1. Load the data
    df = pd.read_csv(raw_path)
    # CRITICAL: Convert empty strings/whitespace to NaN so isnull() works
    df = df.replace(r'^\s*$', pd.NA, regex=True)
    
    column_stats = []
    for col in df.columns:
        column_stats.append({
            "name": col,
            "missing_count": int(df[col].isna().sum()), # Now detects "" as missing
            "type": str(df[col].dtype)
        })
    
    # 2. Initialize the Executor
    cleaner = CleaningExecutor(df)
    
    # 3. Pass the plugins AND the new params to the executor
    # Ensure your CleaningExecutor.run() is also updated to accept params!
    df_cleaned, cleaning_logs = cleaner.run(plugins, params=plugin_params)

    # 4. Save result
    clean_p = Path(clean_path)
    clean_p.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(clean_p, index=False)

    return df_cleaned, cleaning_logs
