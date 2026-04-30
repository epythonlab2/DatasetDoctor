import uuid
import shutil
import time
import asyncio
import json
import pandas as pd

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, Request
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from starlette.concurrency import run_in_threadpool
from fastapi.templating import Jinja2Templates

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
from datasetdoctor.core.utils import path_exists, safe_read_file
from datasetdoctor.core.audit import log_audit_event

router = APIRouter()

# Initialize templates (assuming TEMPLATES_DIR is a Path object from your config)
templates = Jinja2Templates(directory=str(config.TEMPLATES_DIR))

# -------------------------
# UI
# -------------------------

@router.get("/dashboard/", response_class=HTMLResponse)
async def dashboard_missing_id(request: Request): # Add request
    return templates.TemplateResponse("session_expired.html", {"request": request})

@router.get("/", response_class=HTMLResponse)
async def home(request: Request): # Add request
    # This now allows index.html to use {% include "includes/sidebar.html" %}
    return templates.TemplateResponse(
        request=request,
        name="index.html")

@router.get("/uploader", response_class=HTMLResponse)
async def uploader(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="upload.html")

@router.get("/dashboard/{dataset_id}", response_class=HTMLResponse)
async def dashboard(request: Request, dataset_id: str):
    return templates.TemplateResponse(
        request=request,             # Pass request as a keyword arg
        name="dashboard.html",       # Pass template name
        context={"dataset_id": dataset_id} # Pass extra data here
    )

@router.get("/audit", response_class=HTMLResponse)
async def audit(request: Request):
    return templates.TemplateResponse("audit.html", {"request": request})
    

@router.post("/api/v3/system/ping")
async def system_ping(request: Request, background_tasks: BackgroundTasks):
    """
    Receives pings from the frontend to track sessions and landing page hits.
    """
    # Use your helper to record the event
    log_audit_event(
        request, 
        background_tasks, 
        action="SESSION_START", 
        dataset_id="system_init", 
        delta={"message": "User initialized identity module"}
    )
    return {"status": "ok"}

# -------------------------
# Upload
# -------------------------
@router.post("/upload", response_model=UploadResponse)
async def upload(request: Request, file: UploadFile, background_tasks: BackgroundTasks):
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
                    raise HTTPException(413, "File too large.")
                await run_in_threadpool(handle.write, chunk)
        finally:
            await run_in_threadpool(handle.close)

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

    await run_in_threadpool(
        save_meta,
        dataset_id,
        {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "status": "processing",
        },
    )
    # Log successful upload
    log_audit_event(request, background_tasks, "UPLOAD_SUCCESS", dataset_id, {"filename": file.filename, "size": size})

    background_tasks.add_task(run_analysis, dataset_id, upload_path)

    return UploadResponse(dataset_id=dataset_id, status="processing")


# -------------------------
# Analysis
# -------------------------
@router.get("/analysis/{dataset_id}")
async def get_analysis(dataset_id: str):
    # Try a few times with small sleeps if the file isn't ready
    for _ in range(3):
        data = await run_in_threadpool(load_meta, dataset_id)
        if data and data.get("status") == "ready":
            return data
        await asyncio.sleep(0.5) # Wait half a second before retrying
        
    if not data:
        raise HTTPException(404, "Analysis not found.")
    return data


# -------------------------
# Preview
# -------------------------
@router.get("/preview/{dataset_id}")
async def preview(dataset_id: str):
    path = get_upload_path(dataset_id)

    if not await path_exists(path):
        raise HTTPException(404, "Dataset not found.")

    def process():
        df = pd.read_csv(path, nrows=50)
        return {
            "columns": df.columns.tolist(),
            "rows": df.fillna("").to_dict(orient="records"),
        }

    try:
        return await run_in_threadpool(process)
    except Exception as e:
        logger.exception(f"[PREVIEW FAILED] {dataset_id}: {e}")
        raise HTTPException(500, "Preview failed.")


# -------------------------
# Cleaning
# -------------------------
@router.post("/clean/{dataset_id}")
async def clean_dataset(request: Request, dataset_id: str, req: CleanRequest, background_tasks: BackgroundTasks):
    upload_path = get_upload_path(dataset_id)

    if not upload_path.exists():
        raise HTTPException(404, "Dataset not found")

    update_meta(dataset_id, {
        "status": "processing",
        "stage": "initializing",
        "error": None
    })
    
    # Log the cleaning request
    log_audit_event(request, background_tasks, "CLEAN_START", dataset_id, {
        "action": req.action,
        "method": req.method,
        "target_cols": req.columns
    })

    background_tasks.add_task(
        run_cleaning,
        dataset_id,
        str(upload_path),
        str(get_clean_path(dataset_id)),
        action=req.action,
        target_columns=req.columns,
        method=req.method
    )

    return {"status": "accepted"}


# -------------------------
# Metadata
# -------------------------
@router.get("/get_meta/{dataset_id}")
async def get_meta(dataset_id: str):
    meta = load_meta(dataset_id)
    if not meta:
        raise HTTPException(404, "Metadata not found")
    
    # Dynamically check if the cleaned file exists
    clean_path = get_clean_path(dataset_id)
    meta["has_cleaned_data"] = clean_path.exists()
    
    return meta


# -------------------------
# Export
# -------------------------
@router.get("/export/{dataset_id}", response_class=FileResponse)
async def export(dataset_id: str):
    # 1. Get the path (Ensure it's a string or Path object)
    path = get_clean_path(dataset_id)
    
    # 2. Check if file exists using your utility
    if not await path_exists(path):
        # Log this as a warning—user clicked export before cleaning finished
        logger.warning(f"Export attempted for missing file: {dataset_id}")
        raise HTTPException(
            status_code=404, 
            detail="No cleaned data available. Please run a cleaning action first."
        )

    # 3. Return FileResponse
    # media_type="text/csv" is correct for CSVs
    return FileResponse(
        path=path,
        media_type="text/csv",
        filename=f"cleaned_{dataset_id}.csv",
        # Use 'attachment' to force the "Save As" dialog in browsers
        content_disposition_type="attachment" 
    )


# -------------------------
# Score
# -------------------------
@router.get("/score/{dataset_id}")
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


# -------------------------
# Target
# -------------------------
@router.post("/set-target/{dataset_id}")
async def set_target_api(request: Request, dataset_id: str, req: TargetRequest, background_tasks: BackgroundTasks):
    path = get_upload_path(dataset_id)

    if not await path_exists(path):
        raise HTTPException(404, "Dataset not found.")

    await run_in_threadpool(set_target, dataset_id, req.target)
    
    # Log target change
    log_audit_event(request, background_tasks, "SET_TARGET", dataset_id, {"target_column": req.target})
    
    background_tasks.add_task(run_analysis, dataset_id, path)

    return {"status": "processing", "message": f"Target set to '{req.target}'"}


# -------------------------
# Reset
# -------------------------
@router.post("/reset/{dataset_id}")
async def reset(request: Request, dataset_id: str, background_tasks: BackgroundTasks):
    try:
        def delete_dataset_files():
            for base_dir in config.ALL_DATA_DIRS:
                logger.info(f"[RESET] Scanning: {base_dir}")

                for item in base_dir.iterdir():
                    name = item.name

                    if dataset_id in name:
                        logger.info(f"[RESET] Match: {item}")

                        try:
                            if item.is_file():
                                item.unlink()
                                logger.info(f"[RESET] Deleted FILE: {item}")
                            elif item.is_dir():
                                shutil.rmtree(item)
                                logger.info(f"[RESET] Deleted DIR: {item}")
                        except Exception as e:
                            logger.error(f"[RESET] Failed deleting {item}: {e}")

        await run_in_threadpool(delete_dataset_files)
        
        # Log the reset
        log_audit_event(request, background_tasks, "DATASET_RESET", dataset_id, {"reason": "user_initiated"})

        return {
            "status": "dataset reset complete",
            "dataset_id": dataset_id
        }

    except Exception as e:
        logger.exception(f"[RESET FAILED]: {e}")
        raise HTTPException(500, "Reset failed.")


# -------------------------
# Fragments
# -------------------------
@router.get("/about-fragment", response_class=HTMLResponse)
async def about_fragment(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="about.html"
    )
        

@router.get("/clean-fragment", response_class=HTMLResponse)
async def about_fragment(request: Request):
    return templates.TemplateResponse(
        request=request, 
        name="clean.html"
    )
        

@router.get("/audit/logs")
def get_logs(request: Request, limit: int = 100):
    """
    Retrieves engineering audit trails from Supabase.
    """
    # 1. Access the logger instance from the app state
    audit_sys = getattr(request.app.state, "audit_logger", None)
    
    if not audit_sys:
        print("[AUDIT ERROR] AuditLogger not initialized in app.state")
        return []

    try:
        # 2. Query Supabase: newest first, limited by the UI request
        # Note: 'execute()' returns the data in a .data attribute
        response = audit_sys.supabase.table("audit_logs") \
            .select("*") \
            .order("timestamp", desc=True) \
            .limit(limit) \
            .execute()
            
        return response.data

    except Exception as e:
        print(f"[AUDIT ERROR] Supabase fetch failed: {e}")
        return []
