import shutil
import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from starlette.concurrency import run_in_threadpool

# Internal imports
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger
from datasetdoctor.api.background import run_analysis, run_cleaning
from .schemas import TargetRequest, UploadResponse, CleanRequest
from .helpers import (
    get_clean_path,
    get_upload_path,
    load_meta,
    save_meta,
    set_target,
    validate_csv,
    update_meta,
)

router = APIRouter()

# -----------------------------------------------------------------------------
# UTILS
# -----------------------------------------------------------------------------

def _exists(path: Path) -> bool:
    return path.exists()

# -----------------------------------------------------------------------------
# PAGE ROUTES
# -----------------------------------------------------------------------------

@router.get("/", response_class=HTMLResponse)
async def home():
    path = config.TEMPLATES_DIR / "index.html"
    return await run_in_threadpool(path.read_text, encoding="utf-8")


@router.get("/dashboard/{dataset_id}", response_class=HTMLResponse)
async def dashboard(dataset_id: str):
    path = config.TEMPLATES_DIR / "dashboard.html"
    return await run_in_threadpool(path.read_text, encoding="utf-8")

# -----------------------------------------------------------------------------
# UPLOAD & PREVIEW
# -----------------------------------------------------------------------------

@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile, background_tasks: BackgroundTasks):
    """
    Validates and streams CSV upload safely, then triggers background analysis.
    """

    await run_in_threadpool(validate_csv, file)

    dataset_id = str(uuid.uuid4())
    upload_path = get_upload_path(dataset_id)

    size = 0

    try:
        handle = await run_in_threadpool(upload_path.open, "wb")

        try:
            while chunk := await file.read(config.CHUNK_SIZE):
                size += len(chunk)

                if size > config.MAX_FILE_SIZE:
                    raise HTTPException(413, "File exceeds maximum allowed size.")

                await run_in_threadpool(handle.write, chunk)

        finally:
            await run_in_threadpool(handle.close)

        # sanity check
        await run_in_threadpool(pd.read_csv, upload_path, nrows=5)

    except Exception as e:
        if upload_path.exists():
            await run_in_threadpool(upload_path.unlink, missing_ok=True)

        if isinstance(e, HTTPException):
            raise

        logger.exception(f"UPLOAD FAILED [{dataset_id}]: {e}")
        raise HTTPException(400, "Invalid or corrupted CSV file.")

    meta = {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "status": "processing",
    }

    await run_in_threadpool(save_meta, dataset_id, meta)

    background_tasks.add_task(run_analysis, dataset_id, upload_path)

    return UploadResponse(dataset_id=dataset_id, status="processing")


@router.get("/preview/{dataset_id}")
async def preview(dataset_id: str):
    path = get_upload_path(dataset_id)

    if not await run_in_threadpool(_exists, path):
        raise HTTPException(404, "Dataset not found.")

    def build_preview():
        df = pd.read_csv(path, nrows=50)
        return {
            "columns": df.columns.tolist(),
            "rows": df.fillna("").to_dict(orient="records"),
        }

    return await run_in_threadpool(build_preview)

# -----------------------------------------------------------------------------
# CLEANING
# -----------------------------------------------------------------------------

@router.post("/clean/{dataset_id}")
async def clean_dataset_trigger(
    dataset_id: str,
    request: CleanRequest,
    background_tasks: BackgroundTasks,
):
    upload_path = get_upload_path(dataset_id)

    if not upload_path.exists():
        raise HTTPException(404, "Original dataset not found")

    update_meta(
        dataset_id,
        {"status": "processing", "stage": "initializing", "error": None},
    )

    background_tasks.add_task(
        run_cleaning,
        dataset_id,
        str(upload_path),
        str(get_clean_path(dataset_id)),
        action=request.action,
        target_columns=request.columns,
        method=request.method,
    )

    return {"status": "accepted", "action": request.action}

# -----------------------------------------------------------------------------
# METADATA & SCORING
# -----------------------------------------------------------------------------

@router.get("/get_meta/{dataset_id}")
async def get_meta(dataset_id: str):
    meta = await run_in_threadpool(load_meta, dataset_id)

    if not meta:
        raise HTTPException(404, "Metadata not found")

    return meta


@router.get("/score/{dataset_id}")
async def score(dataset_id: str):
    meta = await run_in_threadpool(load_meta, dataset_id)

    if not meta:
        raise HTTPException(404, "Metadata not found")

    if meta.get("status") != "ready":
        return {"status": meta.get("status")}

    summary = meta.get("summary", {})

    return {
        "quality_score": summary.get("quality_score"),
        "ml_readiness": summary.get("ml_readiness"),
        "issues": len(meta.get("suggestions", [])),
    }

# -----------------------------------------------------------------------------
# EXPORT
# -----------------------------------------------------------------------------

@router.get("/export/{dataset_id}", response_class=FileResponse)
async def export(dataset_id: str):
    path = get_clean_path(dataset_id)

    if not await run_in_threadpool(_exists, path):
        raise HTTPException(
            404,
            "Cleaned file not found. Run cleaning first.",
        )

    return FileResponse(
        path=path,
        media_type="text/csv",
        filename=f"cleaned_{dataset_id}.csv",
    )

# -----------------------------------------------------------------------------
# TARGET SETTING
# -----------------------------------------------------------------------------

@router.post("/set-target/{dataset_id}")
async def set_target_api(
    dataset_id: str,
    req: TargetRequest,
    background_tasks: BackgroundTasks,
):
    path = get_upload_path(dataset_id)

    if not path.exists():
        raise HTTPException(404, "Dataset not found")

    await run_in_threadpool(set_target, dataset_id, req.target)

    background_tasks.add_task(run_analysis, dataset_id, path)

    return {
        "status": "processing",
        "message": f"Target set to '{req.target}'",
    }

# -----------------------------------------------------------------------------
# RESET
# -----------------------------------------------------------------------------

@router.post("/reset")
async def reset():
    await run_in_threadpool(shutil.rmtree, config.DATA_DIR, ignore_errors=True)

    def recreate():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(recreate)

    return {"status": "reset complete"}

# -----------------------------------------------------------------------------
# UI FRAGMENTS
# -----------------------------------------------------------------------------

@router.get("/about-fragment", response_class=HTMLResponse)
async def about_fragment():
    path = config.TEMPLATES_DIR / "about.html"

    if not path.exists():
        return HTMLResponse("<p>Content Missing</p>", status_code=404)

    return await run_in_threadpool(path.read_text, encoding="utf-8")


@router.get("/clean-fragment", response_class=HTMLResponse)
async def clean_fragment():
    path = config.TEMPLATES_DIR / "clean.html"

    if not path.exists():
        return HTMLResponse("<p>Content Missing</p>", status_code=404)

    return await run_in_threadpool(path.read_text, encoding="utf-8")
