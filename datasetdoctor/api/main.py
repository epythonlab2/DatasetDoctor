from fastapi import FastAPI
from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from datasetdoctor.core import config
from .routes import router

# 1. Import the updated AuditLogger (the Supabase version)
from datasetdoctor.admincp.audit_engine import AuditLogger 

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        # Keep directory init for data processing, but we no longer need 'logs' dir for audit
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    # 2. Initialize the Supabase-based logger
    # Ensure these variables are defined in your config.py/env
    app.state.audit_logger = AuditLogger(
        supabase_url=config.SUPABASE_URL,
        supabase_key=config.SUPABASE_KEY
    )

    await run_in_threadpool(init_dirs)
    yield

app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)

# Standard CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
app.include_router(router)
