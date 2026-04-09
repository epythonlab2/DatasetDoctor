import pandas as pd
from datetime import datetime
from pathlib import Path

from datasetdoctor.analysis.inspector import analyze_dataset
from datasetdoctor.analysis.cleaning import clean_dataset
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

from .helpers import load_meta, update_meta

def _handle_failure(dataset_id: str, error: Exception, stage: str):
    """Crucial: This must be defined for the catch block to work"""
    logger.error(f"Pipeline Failed at {stage}: {str(error)}")
    update_meta(dataset_id, {
        "status": "failed",
        "error": f"{stage} failed: {str(error)}",
        "stage": stage
    })


def run_analysis(dataset_id: str, path: Path) -> None:
    # 1. Update IMMEDIATELY to stop 404s in the UI
    update_meta(dataset_id, {
        "status": "processing",
        "stage": "analyzing",
        "error": None,
        "analysis_start": datetime.now().isoformat(),
    })

    try:
        meta = load_meta(dataset_id) or {}
        target = meta.get("target")
        filename = meta.get("filename", "Unknown File")

        # 2. Get results
        results = analyze_dataset(str(path), target=target, filename=filename)

        # 3. CRITICAL CHECK: Ensure results is a dictionary
        # This prevents the "method is not iterable" crash
        if callable(results):
            results = results()
        
        if not isinstance(results, dict):
            logger.error(f"Analysis returned {type(results)}, expected dict. Attempting cast.")
            results = dict(results) if hasattr(results, '__iter__') else {"error": "Invalid analysis format"}

        final_payload = {
            **results,
            "dataset_id": dataset_id,
            "status": "ready",
            "stage": "complete",
            "last_analyzed": datetime.now().isoformat(),
        }

        update_meta(dataset_id, final_payload)

    except Exception as e:
        logger.exception(f"Analysis Pipeline Failed for {dataset_id}")
        _handle_failure(dataset_id, e, "Analysis")
        


def run_cleaning(dataset_id: str, raw_path: str, clean_path: str) -> None:
    try:
        # 1. Establish state immediately to stop 404s
        update_meta(dataset_id, {"status": "processing", "stage": "cleaning"})

        # 2. Clean the data and save it to clean_path
        df_cleaned, cleaning_logs = clean_dataset(str(raw_path), str(clean_path))
        
        if callable(cleaning_logs):
            cleaning_logs = cleaning_logs() 

        update_meta(dataset_id, {"stage": "analyzing"})

        meta_data = load_meta(dataset_id) or {}
        target_col = meta_data.get("target")
        file_name = meta_data.get("filename", "unknown_file")

        # 3. FIX: Pass the STRING PATH (clean_path), not the DataFrame (df_cleaned)
        # analyze_dataset expects a path to run pd.read_csv on
        results = analyze_dataset(
            str(clean_path),  # <--- Changed from df_cleaned
            target=target_col, 
            filename=file_name
        )

        # 4. Final Sync
        update_meta(dataset_id, {
            **results,
            "cleaning": cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "cleaned_file_path": str(clean_path) 
        })

    except Exception as e:
        logger.exception("Pipeline crashed")
        _handle_failure(dataset_id, e, "Refinement Pipeline")
