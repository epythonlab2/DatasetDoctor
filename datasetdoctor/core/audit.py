import uuid
from fastapi import Request, BackgroundTasks

def extract_client_id(request: Request) -> str:
    """
    Centralized identity extraction. Normalizes header lookup.
    """
    return (
        request.headers.get("x-client-id")
        or request.headers.get("X-Client-ID")
        or "anonymous_user"
    )

def build_user_context(request: Request, client_id: str) -> dict:
    """
    Constructs a forensic user context object for Supabase.
    """
    return {
        "id": client_id,
        "role": "engineer",
        "ip": request.client.host if request.client else "127.0.0.1",
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
    Dispatches audit logging to Supabase via FastAPI background tasks.
    """
    # Retrieve the Supabase-enabled AuditLogger from app state
    audit_sys = getattr(request.app.state, "audit_logger", None)
    
    if not audit_sys:
        # Fallback print if logger isn't initialized (good for debugging cloud)
        print("⚠️ Warning: audit_logger not found in app.state")
        return

    client_id = extract_client_id(request)
    user_ctx = build_user_context(request, client_id)

    # Dispatches the Supabase 'insert' to a background worker
    background_tasks.add_task(
        audit_sys.log_activity,
        user_ctx,
        action,
        dataset_id,
        delta
    )
