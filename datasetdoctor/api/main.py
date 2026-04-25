from fastapi import FastAPI, Request
from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from datasetdoctor.core import config
from .routes import router

# --- 1. NEW: Import the AuditLogger from your new file ---
from datasetdoctor.admincp.audit_engine import AuditLogger 

# --- 2. NEW: Initialize the logger instance ---
# This creates the .log file if it doesn't exist
audit_log_path = config.LOG_DIR / "system_audit.log"
# Ensure the 'logs' directory exists before starting
audit_log_path.parent.mkdir(parents=True, exist_ok=True)

audit_logger = AuditLogger(log_file=str(audit_log_path))

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)
    yield


app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)

# --- 3. NEW: Attach the logger to the App State ---
# This is the "magic" that makes it available in routes.py
app.state.audit_logger = audit_logger

# Standard CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")

app.include_router(router)
