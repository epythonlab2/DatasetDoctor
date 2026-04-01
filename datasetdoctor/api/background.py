from pathlib import Path

from datasetdoctor.analysis.inspect import analyze_dataset
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

# Import update_meta to ensure atomic merging rather than full overwrites
from .helpers import load_meta, update_meta


def run_analysis(dataset_id: str, path: Path) -> None:
    """
    Background task to analyze a dataset and update its metadata.
    Optimized for memory safety and atomic state updates.
    """
    logger.info(f"Starting analysis for dataset_id: {dataset_id}")

    # 1. Immediate State Update
    # Set status to 'processing' immediately so the UI can show a spinner.
    # We use update_meta to avoid loading the whole file just to change one key.
    update_meta(dataset_id, {"status": "processing", "error": None})

    try:
        # 2. Get the latest target (Load once, just before analysis)
        meta = load_meta(dataset_id)
        target = meta.get("target")

        # 3. Heavy Lifting (The Performance Bottleneck)
        # We pass the string path to ensure the inspector handles the chunked reading
        results = analyze_dataset(str(path), target=target)

        # 4. Atomic Final Merge
        # We use a dictionary merge to ensure we don't drop fields like 'original_filename'
        # or 'upload_time' that might exist in the meta file.
        final_payload = {
            **results,
            "dataset_id": dataset_id,
            "status": "ready",
            "last_analyzed": (
                pd.Timestamp.now().isoformat() if "pd" in globals() else None
            ),
        }

        # update_meta is safer than save_meta here because it re-loads
        # the meta one last time to merge results, preventing race conditions.
        update_meta(dataset_id, final_payload)

        logger.info(f"Analysis completed successfully for {dataset_id}")

    except Exception as e:
        logger.error(f"Analysis failed for {dataset_id}. Error: {e}", exc_info=True)

        # 5. Fail-Safe State
        # We only update the status and error, preserving whatever data was already there.
        error_payload = {
            "status": "failed",
            "error": (
                str(e)
                if config.DEBUG
                else "An internal error occurred during analysis."
            ),
        }
        update_meta(dataset_id, error_payload)
