import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any
from .cleaning_plugins.executor import CleaningExecutor

def clean_dataset(
    raw_path: str, 
    clean_path: str, 
    plugins: list = ["remove_duplicates"], 
    plugin_params: dict = None  # <--- ADD THIS PARAMETER
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Standalone Cleaning Engine.
    """
    # 1. Load the data
    df = pd.read_csv(raw_path)
    
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
