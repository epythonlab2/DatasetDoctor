import json
from pathlib import Path
from typing import Any, Dict

from fastapi import HTTPException, UploadFile
from filelock import FileLock

from datasetdoctor.core import config
from datasetdoctor.core.logger import logger


# =========================================================
# DIRECTORY INIT (safe, idempotent)
# =========================================================
def ensure_directories() -> None:
    config.META_DIR.mkdir(parents=True, exist_ok=True)
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    config.CLEAN_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# PATH HELPERS (NO STORAGE LOGIC HERE)
# =========================================================
def meta_file(dataset_id: str) -> Path:
    return config.META_DIR / f"{dataset_id}.json"


def get_upload_path(dataset_id: str) -> Path:
    return config.UPLOAD_DIR / f"{dataset_id}.csv"


def get_clean_path(dataset_id: str) -> Path:
    return config.CLEAN_DIR / f"{dataset_id}_cleaned.csv"


# =========================================================
# METADATA READ (LOCAL ONLY)
# NOTE: In production S3 mode, this will be bypassed
# =========================================================
def load_meta(dataset_id: str) -> Dict[str, Any]:
    path = meta_file(dataset_id)

    logger.info(f"[DEBUG] Looking for meta at: {path.absolute()}")

    if not path.exists():
        logger.error(f"[META MISS] {dataset_id}")
        raise HTTPException(404, f"Metadata not found: {dataset_id}")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.exception(f"[META READ ERROR] {dataset_id}: {e}")
        raise HTTPException(500, "Metadata read failed")


# =========================================================
# METADATA WRITE (LOCAL ONLY)
# =========================================================
def save_meta(dataset_id: str, data: Dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise ValueError("Meta must be a dict")

    path = meta_file(dataset_id)
    tmp = path.with_suffix(".tmp")

    try:
        tmp.write_text(json.dumps(data), encoding="utf-8")
        tmp.replace(path)  # atomic write
    except Exception as e:
        if tmp.exists():
            tmp.unlink()
        logger.exception(f"[META WRITE FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Failed to save metadata")


# =========================================================
# SAFE UPDATE (LOCAL ONLY)
# NOTE: FileLock is ONLY effective on single instance
# =========================================================
def update_meta(dataset_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    path = meta_file(dataset_id)
    lock = FileLock(str(path) + ".lock")

    with lock:
        meta = load_meta(dataset_id)
        meta.update(updates)
        save_meta(dataset_id, meta)

    return meta


# =========================================================
# BUSINESS LOGIC HELPERS
# =========================================================
def set_target(dataset_id: str, target: str) -> Dict[str, str]:
    target = target.strip()

    if not target:
        raise HTTPException(400, "Target cannot be empty")

    update_meta(dataset_id, {"target": target})

    return {
        "message": "Target set successfully",
        "target": target
    }


# =========================================================
# FILE VALIDATION ONLY (NO STORAGE / NO PATH SIDE EFFECTS)
# =========================================================
ALLOWED_MIME_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "text/plain"
}


def validate_csv(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(400, "Missing filename")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV allowed")

    try:
        sample = file.file.read(1024)
        file.file.seek(0)

        if b"," not in sample:
            raise HTTPException(400, "Invalid CSV format")
    except Exception:
        raise HTTPException(400, "Invalid file content")

    if file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"[MIME WARNING] {file.filename}: {file.content_type}")
