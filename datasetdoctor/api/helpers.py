import json
from pathlib import Path
from typing import Any, Dict

from fastapi import HTTPException, UploadFile

from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

from filelock import FileLock


# -------------------------
# Ensure directories exist (run once at startup)
# -------------------------
def ensure_directories() -> None:
    config.META_DIR.mkdir(parents=True, exist_ok=True)
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    config.CLEAN_DIR.mkdir(parents=True, exist_ok=True)


# -------------------------
# PATH HELPERS
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
    path = meta_file(dataset_id)

    if not path.exists():
        raise HTTPException(404, "Metadata not found.")

    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.exception(f"[META CORRUPTED] {dataset_id}: {e}")
        raise HTTPException(500, "Metadata is corrupted or inaccessible.")


def _validate_meta(data: Dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise ValueError("Meta must be a dictionary.")


def save_meta(dataset_id: str, data: Dict[str, Any]) -> None:
    _validate_meta(data)

    path = meta_file(dataset_id)
    temp_path = path.with_suffix(".tmp")

    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))

        temp_path.replace(path)  # atomic replace

    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        logger.exception(f"[META SAVE FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Failed to save metadata.")


# -------------------------
# SAFE UPDATE (with locking)
# -------------------------
def update_meta(dataset_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    path = meta_file(dataset_id)
    lock = FileLock(str(path) + ".lock")

    with lock:
        meta = load_meta(dataset_id)

        # shallow merge (fast and safe for now)
        meta.update(updates)

        save_meta(dataset_id, meta)

    return meta


# -------------------------
# TARGET MANAGEMENT
# -------------------------
def set_target(dataset_id: str, target: str) -> Dict[str, str]:
    target_clean = target.strip()

    if not target_clean:
        raise HTTPException(400, "Target cannot be empty.")

    update_meta(dataset_id, {"target": target_clean})

    return {"message": "Target set successfully", "target": target_clean}


# -------------------------
# FILE VALIDATION
# -------------------------
ALLOWED_MIME_TYPES = {"text/csv", "application/vnd.ms-excel", "text/plain"}


def validate_csv(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(400, "Missing file name.")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are allowed.")

    # Basic content sniffing (helps catch obvious non-CSV files)
    try:
        sample = file.file.read(1024)
        file.file.seek(0)

        if b"," not in sample:
            raise HTTPException(400, "File does not appear to be a valid CSV.")
    except Exception:
        raise HTTPException(400, "Invalid file content.")

    if file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(
            f"[SUSPICIOUS MIME] {file.filename}: {file.content_type}"
        )
