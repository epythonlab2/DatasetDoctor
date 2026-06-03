from datetime import datetime

from fastapi import APIRouter, HTTPException

# Assuming you have initialized your supabase client
from datasetdoctor.core.db import supabase

from .schemas import Insight

insight_router = APIRouter(prefix="/api/v1", tags=["Insights"])


@insight_router.get("/insights/{task_id}")
async def get_insight(task_id: str):
    # Remove .single() and use .execute()
    response = supabase.table("insights").select("*").eq("task_id", task_id).execute()

    # Check if the data list is empty
    if not response.data:
        raise HTTPException(status_code=404, detail="Insight not found")

    # Return the first item from the list
    return response.data[0]


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
