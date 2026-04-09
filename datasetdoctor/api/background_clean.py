from datetime import datetime
import pandas as pd
from .helpers import get_upload_path, get_clean_path, update_meta, load_meta
from .analysis.inspect import analyze_dataset
from .cleaning_plugins.executor import CleaningExecutor

def run_background_refinement(dataset_id: str):
    """
    Background logic: Upload Path -> Cleaning -> Clean Path -> Analysis -> Meta Update
    """
    try:
        # 1. Resolve Paths via Helpers
        raw_path = get_upload_path(dataset_id)
        clean_path = get_clean_path(dataset_id)

        # 2. Execute Surgery (Cleaning)
        df = pd.read_csv(raw_path)
        cleaner = CleaningExecutor(df)
        
        # We run the V3 plugins (Deduplication, etc.)
        df_cleaned, cleaning_logs = cleaner.run(["remove_duplicates"])

        # 3. Save to Clean Directory (using the helper path)
        df_cleaned.to_csv(clean_path, index=False)

        # 4. Trigger Re-Analysis on the CLEANED data
        # We pass the DataFrame directly to the engine to get updated stats
        meta = load_meta(dataset_id)
        results = analyze_dataset(
            df_cleaned, 
            target=meta.get("target"), 
            filename=meta.get("filename")
        )

        # 5. Final Meta Sync
        # We merge the new analysis results + the cleaning surgery logs
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
