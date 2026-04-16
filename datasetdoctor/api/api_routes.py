import uuid
import time
import socket
import pandas as pd
import shutil

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from datasetdoctor.core import config
from datasetdoctor.core.logger import logger
from datasetdoctor.core.lifespan import lifespan

from datasetdoctor.api.background import run_analysis, run_cleaning
from datasetdoctor.api.schemas import TargetRequest, UploadResponse, CleanRequest

from datasetdoctor.core.utils import path_exists, safe_read_file

# 🔥 STORAGE LAYER (ONLY SOURCE OF TRUTH)
from datasetdoctor.storage.factory import storage


# -------------------------
# APP
# -------------------------
app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")


# -------------------------
# MIDDLEWARE
# -------------------------
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"[{socket.gethostname()}] {request.method} {request.url}")
    return await call_next(request)


START_TIME = time.time()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - START_TIME, 2)
    }


# -------------------------
# ROUTES
# -------------------------

@app.get("/", response_class=HTMLResponse)
async def home():
    return await safe_read_file(config.TEMPLATES_DIR / "index.html")


@app.get("/dashboard/{dataset_id}", response_class=HTMLResponse)
async def dashboard(dataset_id: str):
    return await safe_read_file(config.TEMPLATES_DIR / "dashboard.html")


# -------------------------
# UPLOAD
# -------------------------
@app.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile, background_tasks: BackgroundTasks):

    # validate file (safe optional hook)
    if hasattr(storage, "validate_csv"):
        await run_in_threadpool(storage.validate_csv, file)

    dataset_id = str(uuid.uuid4())

    upload_path = storage.upload_path(dataset_id)

    size = 0

    try:
        # ✅ FIX 1: ensure directory exists (critical for FastAPI Cloud)
        await run_in_threadpool(upload_path.parent.mkdir, parents=True, exist_ok=True)

        # write file safely
        handle = await run_in_threadpool(upload_path.open, "wb")

        try:
            while chunk := await file.read(config.CHUNK_SIZE):
                size += len(chunk)

                if size > config.MAX_FILE_SIZE:
                    raise HTTPException(413, "File too large.")

                await run_in_threadpool(handle.write, chunk)

        finally:
            await run_in_threadpool(handle.close)

        # validate CSV structure
        await run_in_threadpool(pd.read_csv, upload_path, nrows=5)

    except Exception as e:
        logger.exception(f"[UPLOAD FAILED] {dataset_id}: {e}")

        # ✅ FIX 2: safe delete (no direct Path.exists usage)
        if await run_in_threadpool(upload_path.exists):
            await run_in_threadpool(upload_path.unlink, missing_ok=True)

        raise HTTPException(400, "Invalid CSV file.")

    # save metadata
    await run_in_threadpool(storage.save_meta, dataset_id, {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "status": "processing",
    })

    # ✅ FIX 3: pass STRING path (prevents S3 breakage later)
    background_tasks.add_task(run_analysis, dataset_id, str(upload_path))

    return UploadResponse(dataset_id=dataset_id, status="processing")


# -------------------------
# ANALYSIS
# -------------------------
@app.get("/analysis/{dataset_id}")
async def get_analysis(dataset_id: str):
    meta = await run_in_threadpool(storage.load_meta, dataset_id)

    if not meta:
        raise HTTPException(404, "Analysis not found")

    return meta


# -------------------------
# PREVIEW
# -------------------------
@app.get("/preview/{dataset_id}")
async def preview(dataset_id: str):

    path = storage.upload_path(dataset_id)

    if not path.exists():
        raise HTTPException(404, "Dataset not found")

    def process():
        df = pd.read_csv(path, nrows=50)
        return {
            "columns": df.columns.tolist(),
            "rows": df.fillna("").to_dict(orient="records"),
        }

    return await run_in_threadpool(process)


# -------------------------
# CLEANING
# -------------------------
@app.post("/clean/{dataset_id}")
async def clean_dataset(dataset_id: str, request: CleanRequest, background_tasks: BackgroundTasks):

    upload_path = storage.upload_path(dataset_id)

    if not upload_path.exists():
        raise HTTPException(404, "Dataset not found")

    meta = await run_in_threadpool(storage.load_meta, dataset_id) or {}

    meta.update({
        "status": "processing",
        "stage": "initializing",
        "error": None
    })

    await run_in_threadpool(storage.save_meta, dataset_id, meta)

    clean_path = storage.clean_path(dataset_id)

    background_tasks.add_task(
        run_cleaning,
        dataset_id,
        str(upload_path),
        str(clean_path),
        action=request.action,
        target_columns=request.columns,
        method=request.method,
    )

    return {"status": "accepted"}


# -------------------------
# META
# -------------------------
@app.get("/get_meta/{dataset_id}")
async def get_meta(dataset_id: str):
    meta = await run_in_threadpool(storage.load_meta, dataset_id)

    if not meta:
        raise HTTPException(404, "Metadata not found")

    return meta


# -------------------------
# EXPORT
# -------------------------
@app.get("/export/{dataset_id}", response_class=FileResponse)
async def export(dataset_id: str):

    path = storage.clean_path(dataset_id)

    if not path.exists():
        raise HTTPException(404, "Cleaned file not found")

    return FileResponse(
        path,
        media_type="text/csv",
        filename=f"cleaned_{dataset_id}.csv"
    )


# -------------------------
# SET TARGET
# -------------------------
@app.post("/set-target/{dataset_id}")
async def set_target_api(dataset_id: str, req: TargetRequest, background_tasks: BackgroundTasks):

    upload_path = storage.upload_path(dataset_id)

    if not upload_path.exists():
        raise HTTPException(404, "File not found")

    meta = await run_in_threadpool(storage.load_meta, dataset_id) or {}
    meta["target"] = req.target

    await run_in_threadpool(storage.save_meta, dataset_id, meta)

    background_tasks.add_task(run_analysis, dataset_id, upload_path)

    return {"status": "processing"}


# -------------------------
# RESET
# -------------------------
@app.post("/reset")
async def reset():

    await run_in_threadpool(shutil.rmtree, config.DATA_DIR, ignore_errors=True)

    def recreate():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(recreate)

    return {"status": "reset complete"}


# -------------------------
# FRAGMENTS
# -------------------------
@app.get("/about-fragment", response_class=HTMLResponse)
async def about_fragment():
    return await safe_read_file(config.TEMPLATES_DIR / "about.html")


@app.get("/clean-fragment", response_class=HTMLResponse)
async def clean_fragment():
    return await safe_read_file(config.TEMPLATES_DIR / "clean.html")
