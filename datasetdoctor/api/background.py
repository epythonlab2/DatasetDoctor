import pandas as pd
from datetime import datetime
from pathlib import Path
import os

from datasetdoctor.analysis.inspector import analyze_dataset
from datasetdoctor.analysis.cleaning import clean_dataset
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

# 🔥 STORAGE LAYER (ONLY SOURCE OF TRUTH)
from datasetdoctor.storage.factory import storage

def _handle_failure(dataset_id: str, error: Exception, stage: str):
    """Crucial: This must be defined for the catch block to work"""
    logger.error(f"Pipeline Failed at {stage}: {str(error)}")
    update_meta(dataset_id, {
        "status": "failed",
        "error": f"{stage} failed: {str(error)}",
        "stage": stage
    })


def run_analysis(dataset_id: str, path: Path) -> None:

    meta = storage.load_meta(dataset_id) or {}

    meta.update({
        "status": "processing",
        "stage": "analyzing",
        "error": None,
        "analysis_start": datetime.now().isoformat(),
    })

    storage.save_meta(dataset_id, meta)

    try:
        target = meta.get("target")
        filename = meta.get("filename", "Unknown File")

        results = analyze_dataset(str(path), target=target, filename=filename)

        if callable(results):
            results = results()

        if not isinstance(results, dict):
            logger.error("Invalid analysis format")
            results = {"error": "Invalid analysis format"}

        final_payload = {
            **results,
            "dataset_id": dataset_id,
            "status": "ready",
            "stage": "complete",
            "last_analyzed": datetime.now().isoformat(),
        }

        storage.save_meta(dataset_id, final_payload)

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

    try:
        old_meta = storage.load_meta(dataset_id) or {}

        schema_memory = old_meta.get("schema_memory", {})
        if not schema_memory:
            schema_memory = {
                col["name"]: col["type"]
                for col in old_meta.get("columns", [])
            }

        storage.save_meta(dataset_id, {
            **old_meta,
            "status": "processing",
            "stage": "cleaning"
        })

        # -------------------------
        # SOURCE SELECTION (STORAGE-CONTROLLED)
        # -------------------------
        current_source = clean_path

        # If clean file doesn't exist → fallback to raw
        try:
            storage.load_file(dataset_id, Path(clean_path))
        except Exception:
            current_source = raw_path

        # -------------------------
        # PLUGIN PARAMS
        # -------------------------
        plugin_params = {}

        if action == "drop_columns":
            plugin_params["drop_columns"] = {
                "columns_to_drop": target_columns
            }

        elif action == "smart_impute":
            plugin_params["smart_impute"] = {
                "target_column": target_columns[0] if target_columns else None,
                "method": kwargs.get("method", "mean")
            }

        elif action == "cast_schema":
            plugin_params["cast_schema"] = {
                "target_column": target_columns[0] if target_columns else None,
                "method": kwargs.get("method", "auto")
            }

        # -------------------------
        # EXECUTION
        # -------------------------
        df_cleaned, cleaning_logs = clean_dataset(
            raw_path=str(current_source),
            clean_path=str(clean_path),
            plugins=[action],
            plugin_params=plugin_params
        )

        if callable(cleaning_logs):
            cleaning_logs = cleaning_logs()

        # -------------------------
        # RE-ANALYSIS
        # -------------------------
        storage.save_meta(dataset_id, {
            **old_meta,
            "status": "processing",
            "stage": "analyzing_results"
        })

        results = analyze_dataset(
            str(clean_path),
            target=old_meta.get("target"),
            filename=old_meta.get("filename", "dataset.csv")
        )

        if callable(results):
            results = results()

        # -------------------------
        # SCHEMA MEMORY UPDATE
        # -------------------------
        if "columns" in results:

            ui_type_map = {
                "date": "datetime64[ns]",
                "datetime": "datetime64[ns]",
                "float": "float64",
                "int": "Int64",
                "bool": "boolean"
            }

            if action == "cast_schema" and target_columns:
                col = target_columns[0]
                schema_memory[col] = ui_type_map.get(
                    kwargs.get("method", "auto"),
                    kwargs.get("method", "auto")
                )

            for col_info in results["columns"]:
                name = col_info["name"]
                if name in schema_memory:
                    col_info["type"] = schema_memory[name]

        # -------------------------
        # FINAL METADATA WRITE
        # -------------------------
        final_payload = {
            **results,
            "schema_memory": schema_memory,
            "cleaning": cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "last_action": action,
            "cleaned_file_path": str(clean_path)
        }

        storage.save_meta(dataset_id, final_payload)

        logger.info(f"Refine Engine: {action} complete")

    except Exception as e:
        logger.exception(f"Pipeline crashed during {action}")
        _handle_failure(dataset_id, e, f"Refinement Pipeline ({action})")
