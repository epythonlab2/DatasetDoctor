from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

# Assuming you have initialized your supabase client
from datasetdoctor.core.db import supabase

from .schemas import Insight

insight_router = APIRouter(prefix="/api/v1", tags=["Insights"])


@insight_router.get("/insights")
def get_insights(request: Request, limit: int = 100):
    """
    Retrieves engineering insights from Supabase.
    """
    # 1. Match the key name used in your lifespan (app.state.insight_logger)
    insight_sys = getattr(request.app.state, "insight_logger", None)

    if not insight_sys:
        print("[INSIGHT ERROR] insight_logger not initialized in app.state")
        return []

    try:
        # 2. Query Supabase
        # Note: Ensure table name is 'insights' (plural) and column is 'created_at' 
        # to match your SQL schema
        response = (
            insight_sys.supabase.table("insights")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        # 3. Return the full data list (response.data), not just index [0]
        return response.data

    except Exception as e:
        print(f"[INSIGHT ERROR] Supabase fetch failed: {e}")
        return []
'''        
@insight_router.get("/insights")
async def get_insight(task_id: str):
    # Remove .single() and use .execute()
    response = supabase.table("insights").select("*").execute()

    # Check if the data list is empty
    if not response.data:
        raise HTTPException(status_code=404, detail="Insight not found")

    # Return the first item from the list
    return response.data[0]
'''

@insight_router.post("/insights")
async def create_insight(insight: Insight):
    data = insight.model_dump(exclude_unset=True)

    # Handle datetime serialization
    if isinstance(data.get("created_at"), datetime):
        data["created_at"] = data["created_at"].isoformat()

    # Capture the response and return it to the caller
    response = supabase.table("insights").insert(data).execute()

    # Return the first row of the inserted data
    # This provides the client with the full record including the DB-generated ID
    return {
        "message": f"Insight for {insight.task_id} saved.",
        "insight": response.data[0] if response.data else None,
    }


# FastAPI search logic
@insight_router.get("/insights/search/{query}")
async def search_insights(query: str):
    # PostgreSQL websearch_to_tsquery handles natural language better than plain to_tsquery
    response = supabase.rpc(
        "search_insights_function",  # You would create this helper function in SQL
        {"query_text": query},
    ).execute()
    return response.data
