import pandas as pd
from datasetdoctor.core.logger import logger
from pathlib import Path
from typing import Tuple, Dict, Any
from .cleaning_plugins.executor import CleaningExecutor

def clean_dataset(
    raw_path: str, 
    clean_path: str, 
    plugins: list = ["remove_duplicates"], 
    plugin_params: dict = None 
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    
    # 1. Load the data
    df = pd.read_csv(raw_path)
    df = df.replace(r'^\s*$', pd.NA, regex=True)
    
    # 2. Initialize and Run Executor
    cleaner = CleaningExecutor(df)
    df_cleaned, cleaning_logs = cleaner.run(plugins, params=plugin_params)

    # 3. Save result
    # Even though we save to CSV, we return the DF object 
    # so the caller can analyze it while it still has the correct dtypes.
    clean_p = Path(clean_path)
    clean_p.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(clean_p, index=False, date_format='%Y-%m-%d %H:%M:%S')

    return df_cleaned, cleaning_logs
