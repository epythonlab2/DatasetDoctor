import shutil
import uuid
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

# Internal
from datasetdoctor.analysis.cleaning import auto_clean
from datasetdoctor.core import config
from datasetdoctor.core.logger import logger

from .background import run_analysis
from .helpers import (get_clean_path, get_upload_path, load_meta, save_meta,
                      set_target, validate_csv)

# -------------------------
# LIFESPAN
# -------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes directories using paths from config."""

    # Move directory creation to threadpool to avoid blocking event loop on slow disks
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)
    yield


app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")


# -------------------------
# SCHEMAS
# -------------------------
class TargetRequest(BaseModel):
    target: str = Field(..., min_length=1)


class UploadResponse(BaseModel):
    dataset_id: str
    status: str


# -------------------------
# ROUTES
# -------------------------


@app.get("/", response_class=HTMLResponse)
async def home():
    # Performance: Offload blocking disk read
    path = config.TEMPLATES_DIR / "index.html"
    return await run_in_threadpool(path.read_text)


@app.get("/dashboard/{dataset_id}", response_class=HTMLResponse)
async def dashboard(dataset_id: str):
    # Performance: Offload blocking disk read
    path = config.TEMPLATES_DIR / "dashboard.html"
    return await run_in_threadpool(path.read_text)


@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile, background_tasks: BackgroundTasks):
    # Ensure validation (which might read bits of the file) is non-blocking
    await run_in_threadpool(validate_csv, file)

    dataset_id = str(uuid.uuid4())
    upload_path = get_upload_path(dataset_id)
    size = 0

    try:
        # Open file in threadpool to avoid event loop stutter
        handle = await run_in_threadpool(upload_path.open, "wb")

        try:
            while chunk := await file.read(config.CHUNK_SIZE):
                size += len(chunk)
                if size > config.MAX_FILE_SIZE:
                    raise HTTPException(413, "File too large.")

                # Write chunk in threadpool
                await run_in_threadpool(handle.write, chunk)
        finally:
            # Always close the file handle
            await run_in_threadpool(handle.close)

        # Validate CSV structure (non-blocking sample read)
        await run_in_threadpool(pd.read_csv, upload_path, nrows=5)

    except HTTPException:
        if await run_in_threadpool(upload_path.exists):
            await run_in_threadpool(upload_path.unlink, missing_ok=True)
        raise
    except Exception as e:
        if await run_in_threadpool(upload_path.exists):
            await run_in_threadpool(upload_path.unlink, missing_ok=True)
        logger.exception(f"[UPLOAD FAILED] {dataset_id}: {e}")
        raise HTTPException(400, "Invalid CSV file.")

    # Save meta off-loop
    # Persist metadata off-loop
    meta_payload = {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "status": "processing",
    }
    await run_in_threadpool(save_meta, dataset_id, meta_payload)

    background_tasks.add_task(run_analysis, dataset_id, upload_path)

    return UploadResponse(dataset_id=dataset_id, status="processing")


@app.get("/analysis/{dataset_id}")
async def get_analysis(dataset_id: str):
    data = await run_in_threadpool(load_meta, dataset_id)
    if not data:
        raise HTTPException(404, "Analysis not found.")
    return data


@app.get("/preview/{dataset_id}")
async def preview(dataset_id: str):
    path = get_upload_path(dataset_id)

    if not await run_in_threadpool(path.exists):
        raise HTTPException(404, "Dataset not found.")

    try:
        # Move the entire DataFrame transformation logic into the threadpool
        def process_preview():
            df = pd.read_csv(path, nrows=50)
            return {
                "columns": df.columns.tolist(),
                "rows": df.fillna("").to_dict(orient="records"),
            }

        return await run_in_threadpool(process_preview)

    except Exception as e:
        logger.exception(f"[PREVIEW FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Preview failed.")


@app.get("/clean/{dataset_id}")
async def clean(dataset_id: str):
    upload_path = get_upload_path(dataset_id)
    clean_path = get_clean_path(dataset_id)

    if not await run_in_threadpool(upload_path.exists):
        raise HTTPException(404, "Dataset not found.")

    if await run_in_threadpool(clean_path.exists):
        return {"status": "already_cleaned", "download_url": f"/export/{dataset_id}"}

    try:
        # Wrap CPU-heavy pandas operations to prevent loop blocking
        def run_cleaning_pipeline():
            df = pd.read_csv(upload_path)
            cleaned_df = auto_clean(df)
            cleaned_df.to_csv(clean_path, index=False)

        await run_in_threadpool(run_cleaning_pipeline)

    except Exception as e:
        logger.exception(f"[CLEAN FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Cleaning failed.")

    return {"status": "cleaned", "download_url": f"/export/{dataset_id}"}


@app.get("/export/{dataset_id}", response_class=FileResponse)
async def export(dataset_id: str):
    path = get_clean_path(dataset_id)

    if not await run_in_threadpool(path.exists):
        raise HTTPException(404, "Cleaned file not found.")

    return FileResponse(
        path=path, media_type="text/csv", filename=f"cleaned_{dataset_id}.csv"
    )


@app.get("/score/{dataset_id}")
async def score(dataset_id: str):
    meta = await run_in_threadpool(load_meta, dataset_id)

    if not meta:
        raise HTTPException(404, "Metadata not found.")

    if meta.get("status") != "ready":
        return {"status": meta.get("status")}

    summary = meta.get("summary", {})
    suggestions = meta.get("suggestions", [])

    return {
        "quality_score": summary.get("quality_score"),
        "ml_readiness": summary.get("ml_readiness"),
        "issues": len(suggestions),
    }


@app.post("/set-target/{dataset_id}")
async def set_target_api(
    dataset_id: str, req: TargetRequest, background_tasks: BackgroundTasks
):
    path = get_upload_path(dataset_id)

    if not await run_in_threadpool(path.exists):
        raise HTTPException(404, "Dataset not found.")

    # Update metadata and re-run analysis in background
    await run_in_threadpool(set_target, dataset_id, req.target)
    background_tasks.add_task(run_analysis, dataset_id, path)

    return {"status": "processing", "message": f"Target set to '{req.target}'"}


@app.post("/reset")
async def reset():
    try:
        # Offload the entire disk-wipe operation
        await run_in_threadpool(shutil.rmtree, config.DATA_DIR, ignore_errors=True)

        def recreate_dirs():
            for d in config.ALL_DATA_DIRS:
                d.mkdir(parents=True, exist_ok=True)

        await run_in_threadpool(recreate_dirs)
        return {"status": "reset complete"}

    except Exception as e:
        logger.exception(f"[RESET FAILED]: {e}")
        raise HTTPException(500, "Reset failed.")
