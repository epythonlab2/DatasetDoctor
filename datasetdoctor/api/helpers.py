import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict

from fastapi import HTTPException, UploadFile

from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

# Reuse a thread pool for I/O bound tasks to avoid blocking the FastAPI event loop
io_executor = ThreadPoolExecutor(max_workers=4)


# -------------------------
# PATH HELPERS (Pre-calculate where possible)
# -------------------------
def meta_file(dataset_id: str) -> Path:
    return config.META_DIR / f"{dataset_id}.json"


def get_upload_path(dataset_id: str) -> Path:
    return config.UPLOAD_DIR / f"{dataset_id}.csv"


def get_clean_path(dataset_id: str) -> Path:
    return config.CLEAN_DIR / f"{dataset_id}_cleaned.csv"


# -------------------------
# METADATA OPERATIONS
# -------------------------


def load_meta(dataset_id: str) -> Dict[str, Any]:
    """
    Synchronous load for internal calls.
    Performance Note: Uses f.read() which is slightly faster than read_text() for large files.
    """
    path = meta_file(dataset_id)
    if not path.exists():
        raise HTTPException(404, "Metadata not found.")

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.exception(f"[META CORRUPTED] {dataset_id}: {e}")
        raise HTTPException(500, "Metadata is corrupted or inaccessible.")


def save_meta(dataset_id: str, data: Dict[str, Any]) -> None:
    """
    Optimized Atomic Save.
    Removes indent=2 in production to reduce file size and I/O time.
    """
    path = meta_file(dataset_id)
    # Remove mkdir from here; move to a startup script for better performance

    temp_path = path.with_suffix(".tmp")
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            # indent=None is faster and produces smaller files
            json.dump(data, f, separators=(",", ":"))

        # Atomic replace is fast and prevents data loss during crashes
        temp_path.replace(path)
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        logger.exception(f"[META SAVE FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Failed to save metadata.")


def update_meta(dataset_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Optimized merge. Uses dict.update() which is implemented in C.
    """
    meta = load_meta(dataset_id)
    meta.update(updates)  # Faster than manual loop
    save_meta(dataset_id, meta)
    return meta


def set_target(dataset_id: str, target: str) -> Dict[str, str]:
    target_clean = target.strip()
    if not target_clean:
        raise HTTPException(400, "Target cannot be empty.")

    # Optimized: We use update_meta to handle the load/save logic in one optimized flow
    update_meta(dataset_id, {"target": target_clean})
    return {"message": "Target set successfully", "target": target_clean}


# -------------------------
# FILE VALIDATION
# -------------------------
# Validating MIME types via a set is O(1) vs O(N) for a tuple/list
ALLOWED_MIME_TYPES = {"text/csv", "application/vnd.ms-excel", "text/plain"}


def validate_csv(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(400, "Missing file name.")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are allowed.")

    if file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"[SUSPICIOUS MIME] {file.filename}: {file.content_type}")
        # Optional: throw error here if strictness is required
