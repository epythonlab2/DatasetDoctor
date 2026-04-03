from datetime import datetime
from pathlib import Path

from datasetdoctor.analysis.inspect import analyze_dataset
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

from .helpers import load_meta, update_meta


def run_analysis(dataset_id: str, path: Path) -> None:
    """
    Asynchronous background task to perform statistical analysis on a dataset.

    This function manages the lifecycle of the analysis:
    1. Sets initial 'processing' state.
    2. Performs heavy-lifting analysis via analyze_dataset.
    3. Atomically merges results into the dataset metadata.
    4. Handles failures gracefully to avoid leaving the UI in a 'processing' hang.
    """

    # 1. Initial State Sync
    # Mark as processing so polling clients (Frontend Controller) see the spinner.
    update_meta(
        dataset_id,
        {
            "status": "processing",
            "error": None,
            "analysis_start": datetime.now().isoformat(),
        },
    )

    try:
        # 2. Context Loading
        # Retrieve target column or filename if previously set during upload.
        meta = load_meta(dataset_id)
        target = meta.get("target")
        filename = meta.get("filename", "Unknown File")

        logger.info(f"Starting analysis | ID: {dataset_id} | File: {filename}")

        # 3. Execution (The Bottleneck)
        # We pass the path as a string. analyze_dataset is expected to handle
        # memory-efficient chunked reading internally.
        results = analyze_dataset(str(path), target=target, filename=filename)

        # 4. Atomic Final Merge
        # We use a dictionary merge (**) to ensure we don't overwrite
        # original upload metadata (like 'size' or 'user_id').
        final_payload = {
            **results,
            "dataset_id": dataset_id,
            "status": "ready",
            "last_analyzed": datetime.now().isoformat(),
        }

        # update_meta performs a read-modify-write to prevent race conditions
        update_meta(dataset_id, final_payload)

        logger.info(f"Analysis successful | ID: {dataset_id}")

    except Exception as e:
        # 5. Robust Error Handling
        # Ensure the backend doesn't stay in 'processing' forever if a crash occurs.
        logger.error(f"Analysis failed | ID: {dataset_id} | Error: {e}", exc_info=True)

        error_msg = (
            str(e)
            if config.DEBUG
            else "A statistical error occurred during dataset processing."
        )

        update_meta(
            dataset_id,
            {
                "status": "failed",
                "error": error_msg,
                "failed_at": datetime.now().isoformat(),
            },
        )
