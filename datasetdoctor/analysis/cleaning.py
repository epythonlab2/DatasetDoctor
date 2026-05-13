from pathlib import Path
from typing import Any, Dict, Tuple

import pandas as pd

from datasetdoctor.core.logger import logger

from .cleaning_plugins.executor import CleaningExecutor


def clean_dataset(
    raw_path: str,
    clean_path: str,
    plugins: list = ["remove_duplicates", "general_clean"],
    plugin_params: dict = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:

    # Use 'c' engine and only necessary dtypes if possible
    # replace() on a full 500k DF is slow; only do it if necessary or on specific columns
    df = pd.read_csv(raw_path, engine="c", low_memory=False)
    
    # Optimization: replace only objects/strings to save CPU
    cols_to_fix = df.select_dtypes(include=['object']).columns
    df[cols_to_fix] = df[cols_to_fix].replace(r"^\s*$", pd.NA, regex=True)

    cleaner = CleaningExecutor(df)
    df_cleaned, cleaning_logs = cleaner.run(plugins, params=plugin_params)

    # Fast Save
    clean_p = Path(clean_path)
    clean_p.parent.mkdir(parents=True, exist_ok=True)
    
    # to_csv is slow. If you don't need index, index=False is good.
    df_cleaned.to_csv(clean_p, index=False, date_format="%Y-%m-%d %H:%M:%S")

    return df_cleaned, cleaning_logs
