from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

# 1. Import the updated AuditLogger (the Supabase version)
from datasetdoctor.admincp.audit_engine import AuditLogger
from datasetdoctor.services.insight_logger import InsightLogger
from datasetdoctor.core import config

from .insight_routes import insight_router
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        # Keep directory init for data processing, but we no longer need 'logs' dir for audit
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    # 2. Initialize the Supabase-based logger
    # Ensure these variables are defined in your config.py/env
    app.state.audit_logger = AuditLogger(
        supabase_url=config.SUPABASE_URL, supabase_key=config.SUPABASE_KEY
    )
    
    app.state.insight_logger = InsightLogger()

    await run_in_threadpool(init_dirs)
    yield


app = FastAPI(
    title="Dataset Doctor",
    version="1.0.0",
    # Paste your chosen 155-character SEO description here:
    description="Diagnose ML readiness with Dataset Doctor. Automate data cleaning, outlier detection, data leakage checks, handle missing data, and fix mismatches fast.",
    lifespan=lifespan,
)

# Standard CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change "*" to your specific frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
app.mount("/images", StaticFiles(directory=config.STATIC_DIR), name="images")


@app.middleware("http")
async def cache_control(request: Request, call_next):
    response = await call_next(request)

    if request.url.path.endswith(
        (".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".svg")
    ):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

    return response


app.include_router(router)
app.include_router(insight_router)
