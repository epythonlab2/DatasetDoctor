import pandas as pd
from datetime import datetime
from pathlib import Path
import os

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
        


def run_cleaning(
    dataset_id: str, 
    raw_path: str, 
    clean_path: str, 
    action: str, 
    target_columns: list = None
) -> None:
    try:
        # 1. Update status to inform the UI
        update_meta(dataset_id, {"status": "processing", "stage": "cleaning"})

        # --- PERSISTENCE LOGIC ---
        # If clean_path exists, it means the user has already performed an action.
        # We load the 'cleaned' file as our source to make the changes additive.
        current_source = clean_path if os.path.exists(clean_path) else raw_path
        logger.info(f"Refine Engine: Starting {action}. Source: {current_source}")
        # -------------------------

        # 2. Package parameters for the specific action
        plugin_params = {}
        if action == "drop_columns":
            plugin_params["drop_columns"] = {"columns_to_drop": target_columns}
        
        # 3. Execute the cleaning engine
        # We pass 'current_source' instead of always passing 'raw_path'
        df_cleaned, cleaning_logs = clean_dataset(
            raw_path=str(current_source), 
            clean_path=str(clean_path),
            plugins=[action],
            plugin_params=plugin_params
        )
        
        if callable(cleaning_logs):
            cleaning_logs = cleaning_logs() 

        # 4. Analyze the newly updated file
        update_meta(dataset_id, {"stage": "analyzing"})

        meta_data = load_meta(dataset_id) or {}
        target_col = meta_data.get("target")
        file_name = meta_data.get("filename", "unknown_file")

        # Re-run analysis on the clean_path to get updated column lists/stats
        results = analyze_dataset(
            str(clean_path), 
            target=target_col, 
            filename=file_name
        )

        # 5. Final Sync
        # Merging results updates the 'columns' list in meta, 
        # which refreshes your UI dropdown.
        update_meta(dataset_id, {
            **results,
            "cleaning": cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "cleaned_file_path": str(clean_path) 
        })
        
        logger.info(f"Refine Engine: {action} complete. Metadata synced.")

    except Exception as e:
        logger.exception(f"Pipeline crashed during {action}")
        _handle_failure(dataset_id, e, f"Refinement Pipeline ({action})")
