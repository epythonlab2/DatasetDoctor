# core/audit.py

import uuid
from fastapi import Request, BackgroundTasks


def extract_client_id(request: Request) -> str:
    """
    Centralized identity extraction.
    Always normalizes header lookup.
    """
    return (
        request.headers.get("x-client-id")
        or request.headers.get("X-Client-ID")
        or "anonymous_user"
    )


def build_user_context(request: Request, client_id: str) -> dict:
    """
    Constructs a consistent user context object.
    """
    return {
        "id": client_id,
        "role": "engineer",
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "correlation_id": str(uuid.uuid4())
    }


def log_audit_event(
    request: Request,
    background_tasks: BackgroundTasks,
    action: str,
    dataset_id: str,
    delta: dict,
):
    """
    Dispatches audit logging safely via FastAPI background tasks.
    """

    audit_sys = getattr(request.app.state, "audit_logger", None)
    if not audit_sys:
        return

    client_id = extract_client_id(request)
    user_ctx = build_user_context(request, client_id)

    background_tasks.add_task(
        audit_sys.log_activity,
        user_ctx,
        action,
        dataset_id,
        delta
    )
