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
    action: str = None,
    target_columns: list = None,
    pipeline: list = None,
    **kwargs,
) -> None:
    """
    Executes a sequence of cleaning steps. 
    Maintains 'schema_memory' to ensure user-defined types persist 
    through re-analysis cycles.
    """
    try:
        # 1. INITIALIZE PIPELINE
        # Support both Pydantic objects (batch) and single-action calls (legacy)
        if pipeline:
            steps = pipeline
        else:
            @dataclass
            class SimpleStep:
                action: str
                columns: list
                method: str
            steps = [SimpleStep(
                action=action, 
                columns=target_columns, 
                method=kwargs.get("method")
            )]

        # 2. STATE PREPARATION
        old_meta = load_meta(dataset_id) or {}
        schema_memory = old_meta.get("schema_memory", {})
        
        # If starting fresh, initialize memory from existing column types
        if not schema_memory:
            schema_memory = {col["name"]: col["type"] for col in old_meta.get("columns", [])}

        # Mapping UI keywords to Pandas-compatible dtypes
        ui_type_map = {
            "date": "datetime64[ns]", "datetime": "datetime64[ns]",
            "float": "float64", "int": "Int64", "bool": "boolean", "encode": "Int64",
        }

        # 3. ITERATIVE PIPELINE EXECUTION
        for i, step in enumerate(steps):
            # Normalizing access (Object vs Dict)
            curr_action = step.action if hasattr(step, 'action') else step.get("action")
            curr_cols = step.columns if hasattr(step, 'columns') else step.get("columns")
            curr_method = getattr(step, 'method', "mean") if hasattr(step, 'method') else step.get("method", "mean")

            update_meta(dataset_id, {
                "status": "processing", 
                "stage": f"Step {i+1}/{len(steps)}: {curr_action}..."
            })

            # Select source: Use raw file for first step, otherwise use current working clean file
            current_source = clean_path if os.path.exists(clean_path) else raw_path

            # 4. CONFIGURE PLUGIN PARAMS
            plugin_params = {}
            if curr_action == "drop_columns":
                plugin_params["drop_columns"] = {"columns_to_drop": curr_cols}
            elif curr_action == "smart_impute":
                plugin_params["smart_impute"] = {
                    "target_column": curr_cols[0] if curr_cols else None, 
                    "method": curr_method
                }
            elif curr_action == "cast_schema":
                plugin_params["cast_schema"] = {
                    "target_column": curr_cols[0] if curr_cols else None, 
                    "method": curr_method
                }
            else:
                plugin_params[curr_action] = {}

            # 5. EXECUTE CLEANING ENGINE
            # The engine saves results to clean_path incrementally
            df_cleaned, cleaning_logs = clean_dataset(
                raw_path=str(current_source),
                clean_path=str(clean_path),
                plugins=[curr_action],
                plugin_params=plugin_params,
            )

            # 6. CONDITIONAL SCHEMA PERSISTENCE
            # Only update memory if the cast was successful to avoid reporting false successes
            if curr_action == "cast_schema" and curr_cols:
                logs = cleaning_logs() if callable(cleaning_logs) else cleaning_logs
                
                # Check for error signals in plugin logs
                has_error = any(
                    str(log.get('status', '')).lower() == 'error' 
                    for log in (logs if isinstance(logs, list) else [])
                )

                if not has_error:
                    target_type = ui_type_map.get(curr_method, curr_method)
                    schema_memory[curr_cols[0]] = target_type
                    logger.info(f"Committed {curr_cols[0]} as {target_type} to schema memory.")
                else:
                    logger.warning(f"Cast failed for {curr_cols[0]}. Memory not updated.")

        # 7. FINAL ANALYSIS
        # We re-analyze the full file once after the entire batch is finished
        analysis_gen = analyze_dataset(
            str(clean_path),
            target=old_meta.get("target"),
            filename=old_meta.get("filename", "dataset.csv"),
        )

        results = {}
        for update in analysis_gen:
            results = update 
            
            # Apply schema memory to override Pandas' automated type detection
            if "columns" in results:
                for col_info in results["columns"]:
                    name = col_info["name"]
                    if name in schema_memory:
                        col_info["type"] = schema_memory[name]

            update_meta(dataset_id, {
                **results,
                "status": "processing",
                "stage": "Finalizing Metrics..."
            })

        # 8. PUBLISH FINAL STATE
        final_payload = {
            **results,
            "schema_memory": schema_memory,
            "cleaning": cleaning_logs() if callable(cleaning_logs) else cleaning_logs,
            "status": "ready",
            "stage": "complete",
            "last_action": steps[-1].action if hasattr(steps[-1], 'action') else steps[-1].get("action"),
            "cleaned_file_path": str(clean_path),
        }

        update_meta(dataset_id, final_payload)
        logger.info(f"Pipeline complete for {dataset_id}.")

    except Exception as e:
        logger.exception("Refinement Pipeline Crashed")
        _handle_failure(dataset_id, e, "Refinement Pipeline")
