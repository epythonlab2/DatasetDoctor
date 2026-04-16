from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from contextlib import asynccontextmanager

from datasetdoctor.core import config
from .routes import router  # We will create this next

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes directories using paths from config."""
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)
    yield

app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)

# Mount static files
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")

# Include the routes from the other file
app.include_router(router)
