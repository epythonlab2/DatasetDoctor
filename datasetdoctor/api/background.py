import os
from datetime import datetime
from pathlib import Path

from datasetdoctor.analysis.cleaning import clean_dataset
from datasetdoctor.analysis.inspector import analyze_dataset
from datasetdoctor.core.logger import logger

from .helpers import load_meta, update_meta


def _handle_failure(dataset_id: str, error: Exception, stage: str):
    """Crucial: This must be defined for the catch block to work"""
    logger.error(f"Pipeline Failed at {stage}: {str(error)}")
    update_meta(
        dataset_id,
        {"status": "failed", "error": f"{stage} failed: {str(error)}", "stage": stage},
    )


def run_analysis(dataset_id: str, path: Path) -> None:
    update_meta(dataset_id, {"status": "processing", "stage": "Scanning data..."})

    try:
        meta = load_meta(dataset_id) or {}
        target = meta.get("target")
        filename = meta.get("filename", "Unknown File")

        analysis_gen = analyze_dataset(str(path), target=target, filename=filename)

        # 1. Catch the partial results (summary + columns + missing %)
        partial_data = next(analysis_gen) # Gets rows, cols, missing, redundancy
        update_meta(dataset_id, {
            **partial_data, # CRITICAL: This sends the actual numbers to the DB
            "status": "processing",
            "stage": "Top metrics ready..."
        })

        # 2. Catch final results (Plugins + Scores)
        final_results = next(analysis_gen)

        final_payload = {
            **final_results,
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
    **kwargs,
) -> None:
    try:
        # 1. LOAD OLD STATE FIRST
        old_meta = load_meta(dataset_id) or {}
        # This is our "Memory". If it doesn't exist, initialize it from current columns.
        schema_memory = old_meta.get("schema_memory", {})
        if not schema_memory:
            schema_memory = {
                col["name"]: col["type"] for col in old_meta.get("columns", [])
            }

        update_meta(dataset_id, {"status": "processing", "stage": "cleaning"})

        # 2. SOURCE SELECTION
        current_source = clean_path if os.path.exists(clean_path) else raw_path

        # 3. PLUGIN PARAMS
        plugin_params = {}
        if action == "drop_columns":
            plugin_params["drop_columns"] = {"columns_to_drop": target_columns}
        elif action == "smart_impute":
            method = kwargs.get("method", "mean")
            col = target_columns[0] if target_columns else None
            plugin_params["smart_impute"] = {"target_column": col, "method": method}
        elif action == "cast_schema":
            target_type = kwargs.get("method", "auto")
            target_col = target_columns[0] if target_columns else None
            plugin_params["cast_schema"] = {
                "target_column": target_col,
                "method": target_type,
            }

        # 4. EXECUTE ENGINE
        df_cleaned, cleaning_logs = clean_dataset(
            raw_path=str(current_source),
            clean_path=str(clean_path),
            plugins=[action],
            plugin_params=plugin_params,
        )

        if callable(cleaning_logs):
            cleaning_logs = cleaning_logs()

        # 5. RE-ANALYZE (The "Forgetful" Step)
        # 5. RE-ANALYZE (Consuming the Generator)
        update_meta(dataset_id, {"stage": "analyzing_results"})

        # Create the generator
        analysis_gen = analyze_dataset(
            str(clean_path),
            target=old_meta.get("target"),
            filename=old_meta.get("filename", "dataset.csv"),
        )

        # Consume the generator to get the FINAL result
        # This skips the partial yield and waits for the full analysis to complete
        results = None
        for update in analysis_gen:
            results = update 

        # Now 'results' is a dictionary (the last yield from analyze_dataset)
        
        # 6. ENFORCE MEMORY
        if "columns" in results:
            ui_type_map = {
                "date": "datetime64[ns]",
                "datetime": "datetime64[ns]",
                "float": "float64",
                "int": "Int64",
                "bool": "boolean",
                "encode": "Int64",
            }

            # Update memory if we just performed a cast
            if action == "cast_schema" and target_columns:
                target_col = target_columns[0]
                requested_type = kwargs.get("method", "auto")
                schema_memory[target_col] = ui_type_map.get(
                    requested_type, requested_type
                )

            # Apply memory to analyzer results
            for col_info in results["columns"]:
                name = col_info["name"]
                if name in schema_memory:
                    # OVERRIDE: If we have a stored type, use it.
                    # Ignore what the analyzer found in the CSV text.
                    col_info["type"] = schema_memory[name]

        # 7. UPDATE METADATA WITH SCHEMA_MEMORY
        final_payload = {
            **results,
            "schema_memory": schema_memory,  # Save the memory back!
            "cleaning": cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "last_action": action,
            "cleaned_file_path": str(clean_path),
        }

        update_meta(dataset_id, final_payload)
        logger.info(f"Refine Engine: {action} complete. Schema memory updated.")

    except Exception as e:
        logger.exception(f"Pipeline crashed during {action}")
        _handle_failure(dataset_id, e, f"Refinement Pipeline ({action})")
