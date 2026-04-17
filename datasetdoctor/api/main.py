from fastapi import FastAPI
from contextlib import asynccontextmanager
from starlette.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles

from datasetdoctor.core import config
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    def init_dirs():
        for d in config.ALL_DATA_DIRS:
            d.mkdir(parents=True, exist_ok=True)

    await run_in_threadpool(init_dirs)
    yield


app = FastAPI(title="DatasetDoctor API", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")

app.include_router(router)
