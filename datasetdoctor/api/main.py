from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

# Internal project modules
from datasetdoctor.admincp.audit_engine import AuditLogger
from datasetdoctor.services.insight_logger import InsightLogger
from datasetdoctor.core import config
from .insight_routes import insight_router, web_router
from .routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for the FastAPI application.
    Handles service initialization and directory setup on startup.
    """
    def init_dirs():
        """Ensure required data directories exist."""
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    # Initialize external service loggers and attach to app state
    app.state.audit_logger = AuditLogger(
        supabase_url=config.SUPABASE_URL, 
        supabase_key=config.SUPABASE_KEY
    )
    app.state.insight_logger = InsightLogger()

    # Run blocking directory setup in a thread pool
    await run_in_threadpool(init_dirs)
    yield
    # Cleanup logic can be added here if needed

# Initialize the application
app = FastAPI(
    title="Dataset Doctor",
    version="1.0.0",
    description="Diagnose ML readiness with Dataset Doctor. Automate data cleaning, "
                "outlier detection, data leakage checks, handle missing data, and fix mismatches fast.",
    lifespan=lifespan,
)

# CORS Configuration: Enable cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update to specific origins for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS, Images)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
app.mount("/images", StaticFiles(directory=config.STATIC_DIR), name="images")

@app.middleware("http")
async def cache_control(request: Request, call_next):
    """
    Middleware to force immutable caching for static assets.
    Improves performance by reducing redundant server requests.
    """
    response = await call_next(request)
    
    # Apply long-term cache headers to static files
    if request.url.path.endswith((".css", ".js", ".jpg", ".jpeg", ".png", ".webp", ".svg")):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

    return response

# Register application routers
# web_router: Handles HTML/Jinja2 page navigation (no prefix)
# insight_router: Handles JSON API data (prefixed with /api/v1)
# router: General project routes
app.include_router(router)
app.include_router(web_router)
app.include_router(insight_router)
