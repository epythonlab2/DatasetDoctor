from fastapi import FastAPI
from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles

from datasetdoctor.core import config
from .routes import router

from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)
    yield
    


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        
        # We add 'blob:' to script-src and img-src because 
        # Chart.js sometimes uses blobs to render canvas elements.
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' *; " # Added '*' to allow fetching data from your API
            "worker-src 'self' blob:;" # Chart.js/Lucide sometimes use web workers
        )
        
        response.headers["Content-Security-Policy"] = csp_policy
        return response



app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)
app.add_middleware(SecurityHeadersMiddleware)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")

app.include_router(router)
