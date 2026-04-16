from contextlib import asynccontextmanager
from datasetdoctor.storage.factory import storage


@asynccontextmanager
async def lifespan(app):
    storage.ensure_dirs()
    yield
