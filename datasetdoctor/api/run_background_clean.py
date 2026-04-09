# datasetdoctor/api/background_clean.py
from datetime import datetime
from pathlib import Path
import pandas as pd

# Absolute imports to prevent ModuleNotFoundError
from datasetdoctor.analysis.inspect import analyze_dataset
from .cleaning_plugins.executor import CleaningExecutor
from datasetdoctor.core.logger import logger

def run_cleaning(dataset_id: str, raw_path:str, clean_path:str):
    """
    Background logic: Upload Path -> Cleaning -> Clean Path -> Analysis -> Meta Update
    """
    try:
        # 1. Resolve Paths via Helpers

        # 2. Execute Surgery (Deduplication)
        # Note: We load the CSV here once for both cleaning AND analysis
        df = pd.read_csv(raw_path)
        cleaner = CleaningExecutor(df)
        
        # Execute V3 plugins
        df_cleaned, cleaning_logs = cleaner.run(["remove_duplicates"])

        # 3. Save to Clean Directory
        # Ensure directory exists before saving
        clean_path.parent.mkdir(parents=True, exist_ok=True)
        df_cleaned.to_csv(clean_path, index=False)

        # 4. Trigger Re-Analysis on the CLEANED data
        # Fetch existing meta to preserve context (target/filename)
        meta = load_meta(dataset_id)
        
        # We pass the DF directly. The hybrid engine will skip 
        # the chunked file reading and analyze this DF immediately.
        results = analyze_dataset(
            df_cleaned, 
            target=meta.get("target"), 
            filename=meta.get("filename")
        )

        # 5. Final Meta Sync
        # Atomic merge of new stats + cleaning history
        update_meta(dataset_id, {
            **results,
            "cleaning": cleaning_logs,
            "status": "ready",
            "last_refined": datetime.now().isoformat(),
            "cleaned_file_path": str(clean_path) 
        })

        logger.info(f"Deduplication Complete | ID: {dataset_id}")

    except Exception as e:
        logger.error(f"Deduplication Failed | ID: {dataset_id} | {e}", exc_info=True)
        update_meta(dataset_id, {
            "status": "failed", 
            "error": str(e)
        })
