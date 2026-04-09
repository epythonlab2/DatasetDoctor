import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any
from .cleaning_plugins.executor import CleaningExecutor

def clean_dataset(raw_path: str, clean_path: str, plugins: list = ["remove_duplicates"]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Standalone Cleaning Engine. 
    Equivalent to analyze_dataset.
    """
    # 1. Load
    df = pd.read_csv(raw_path)
    
    # 2. Transform
    cleaner = CleaningExecutor(df)
    df_cleaned, cleaning_logs = cleaner.run(plugins)

    # 3. Persist
    clean_p = Path(clean_path)
    clean_p.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(clean_p, index=False)

    return df_cleaned, cleaning_logs
