from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

# Assuming you have initialized your supabase client
from datasetdoctor.core.db import supabase
from fastapi.templating import Jinja2Templates
from datasetdoctor.core.logger import logger
from datasetdoctor.core import config
from .schemas import Insight
from cachetools import TTLCache

insight_router = APIRouter(prefix="/api/v1", tags=["Insights"])

# Initialize templates (assuming TEMPLATES_DIR is a Path object from your config)
templates = Jinja2Templates(directory=str(config.TEMPLATES_DIR))

# Create a cache: 100 items max, expires after 60 seconds
insights_cache = TTLCache(maxsize=100, ttl=60)

@insight_router.get("/insights")
def get_insights(request: Request, limit: int = 100):
    # Create a unique key based on the limit
    cache_key = f"insights_limit_{limit}"
    
    # Check if data exists in cache
    if cache_key in insights_cache:
        return insights_cache[cache_key]

    insight_sys = getattr(request.app.state, "insight_logger", None)
    if not insight_sys:
        return []

    try:
        response = (
            insight_sys.supabase.table("insights")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        
        # Save to cache
        insights_cache[cache_key] = response.data
        return response.data

    except Exception as e:
        logger.error(f"[INSIGHT ERROR] Supabase fetch failed: {e}")
        return []
        
@insight_router.get("/insights/{title_slug}")
async def get_insight_detail(request: Request, title_slug: str):
    insight_sys = getattr(request.app.state, "insight_logger", None)
    
    try:
        # Use .execute() without .single() to be safer and match the data structure
        response = (
            insight_sys.supabase.table("insights")
            .select("*")
            .eq("slug", title_slug)
            .execute()
        )
        
        # Check if data exists in the list
        if not response.data:
            return {"error": "Insight not found"}
            
        # If using .execute() (no .single()), the object is in response.data[0]
        insight_item = response.data[0]
        logger.info(insight_item)
        
        return templates.TemplateResponse(
            name="detail.html", 
            request=request, 
            context={"insight": insight_item}
        )
        
    except Exception as e:
        # Don't return a JSON dict here if the template expects an HTML page
        # It will break your UI. Print to terminal instead.
        print(f"Error: {e}")
        return {"error": str(e)}
        
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
