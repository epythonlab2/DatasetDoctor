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
    target_columns: list = None,
    **kwargs
) -> None:
    """
    Executes cleaning and immediately re-analyzes the file to 
    ensure the UI dropdowns reflect the fixed data.
    """
    try:
        # 1. Update status to inform the UI that cleaning is in progress
        update_meta(dataset_id, {"status": "processing", "stage": "cleaning"})

        # 2. Additive Logic: Use existing clean file as source if it exists
        current_source = clean_path if os.path.exists(clean_path) else raw_path
        logger.info(f"Refine Engine: Starting {action}. Source: {current_source}")

        # 3. Package parameters for the specific plugin
        plugin_params = {}
        if action == "drop_columns":
            plugin_params["drop_columns"] = {"columns_to_drop": target_columns}
        elif action == "smart_impute":
            method = kwargs.get("method", "mean")
            col = target_columns[0] if target_columns else None
            plugin_params["smart_impute"] = {"target_column": col, "method": method}
                
        # 4. Execute the cleaning engine
        df_cleaned, cleaning_logs = clean_dataset(
            raw_path=str(current_source), 
            clean_path=str(clean_path),
            plugins=[action],
            plugin_params=plugin_params
        )
        
        # 5. Safety check for logs
        if callable(cleaning_logs):
            cleaning_logs = cleaning_logs() 

        # 6. RE-ANALYZE: This is the key to updating the "Missing" dropdown
        update_meta(dataset_id, {"stage": "analyzing_results"})
        
        meta_data = load_meta(dataset_id) or {}
        results = analyze_dataset(
            str(clean_path), 
            target=meta_data.get("target"), 
            filename=meta_data.get("filename", "dataset.csv")
        )

        # 7. Safety check: Ensure analysis results are a dictionary
        if callable(results): results = results()
        if not isinstance(results, dict): results = {}

        # 8. Push final state to UI
        update_meta(dataset_id, {
            **results,
            "cleaning": cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "last_action": action,
            "cleaned_file_path": str(clean_path) 
        })
        
        logger.info(f"Refine Engine: {action} complete. Metadata synced.")

    except Exception as e:
        logger.exception(f"Pipeline crashed during {action}")
        _handle_failure(dataset_id, e, f"Refinement Pipeline ({action})")
