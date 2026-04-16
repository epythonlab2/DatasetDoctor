from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
from fastapi import FastAPI
# -------------------------
# LIFESPAN
# -------------------------
from . import config

@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)

    # Debug: print routes
    print("=== ROUTES ===")
    for r in app.routes:
        print(r.path)

    yield
