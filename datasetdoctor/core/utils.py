# /core/utils.py
from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool


async def path_exists(path):
    return await run_in_threadpool(path.exists)


async def safe_read_file(path):
    if not await path_exists(path):
        raise HTTPException(404, f"{path.name} not found")

    try:
        return await run_in_threadpool(path.read_text, encoding="utf-8")
    except Exception:
        raise HTTPException(500, "Failed to read file")
