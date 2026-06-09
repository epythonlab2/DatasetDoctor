from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from cachetools import TTLCache

from datasetdoctor.core.db import supabase
from datasetdoctor.core.logger import logger
from datasetdoctor.core import config
from .schemas import Insight

# 1. Router Setup
insight_router = APIRouter(prefix="/api/v1", tags=["Insights API"])
web_router = APIRouter(tags=["Web Pages"])

templates = Jinja2Templates(directory=str(config.TEMPLATES_DIR))
insights_cache = TTLCache(maxsize=100, ttl=60)

# --- WEB ROUTES ---

@web_router.get("/insights/{slug}", response_class=HTMLResponse)
async def get_detail_page(request: Request, slug: str):
    """Renders the insight detail page shell."""
    return templates.TemplateResponse(
        request=request, 
        name="detail.html", 
        context={"slug": slug}
    )

# --- API ROUTES ---

@insight_router.get("/insights")
def get_insights(request: Request, limit: int = 100):
    """Fetch all insights with simple TTL caching."""
    cache_key = f"insights_limit_{limit}"
    if cache_key in insights_cache:
        return insights_cache[cache_key]

    insight_sys = getattr(request.app.state, "insight_logger", None)
    if not insight_sys:
        return []

    try:
        response = insight_sys.supabase.table("insights")\
            .select("*")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        
        insights_cache[cache_key] = response.data
        return response.data
    except Exception as e:
        logger.error(f"Failed to fetch insights: {e}")
        return []
        

@insight_router.get("/insights/{slug}")
async def get_insight_detail(request: Request, slug: str):
    # 1. Use the slug as a unique cache key
    cache_key = f"insight_detail_{slug}"
    if cache_key in insights_cache:
        return insights_cache[cache_key]

    insight_sys = getattr(request.app.state, "insight_logger", None)
    if not insight_sys:
        raise HTTPException(status_code=500, detail="Service unavailable")

    try:
        response = insight_sys.supabase.table("insights")\
            .select("*").eq("slug", slug).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Insight not found")
        
        item = response.data[0]
        
        # Formatting
        raw_date = item.get("created_at", "2026-01-01T00:00:00+00:00")
        try:
            dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
            item["date_formatted"] = dt.strftime("%B %d, %Y")
        except ValueError:
            item["date_formatted"] = "Date Unknown"

        # 2. Store specific result in cache
        insights_cache[cache_key] = item
        return item
    except Exception as e:
        logger.error(f"API Error fetching insight {slug}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
        

@insight_router.get("/insights/{slug}/related")
async def get_related_insights(request: Request, slug: str):
    # 1. Use unique key for related articles
    cache_key = f"related_{slug}"
    if cache_key in insights_cache:
        return insights_cache[cache_key]
        
    insight_sys = getattr(request.app.state, "insight_logger", None)
    
    current = insight_sys.supabase.table("insights")\
        .select("category, id").eq("slug", slug).single().execute()
    
    if not current.data:
        return []
        
    related = insight_sys.supabase.table("insights")\
        .select("*")\
        .eq("category", current.data['category'])\
        .neq("id", current.data['id'])\
        .limit(3).execute()
        
    # 2. Store specific related result
    insights_cache[cache_key] = related.data
    return related.data
    

@insight_router.post("/insights")
async def create_insight(insight: Insight):
    """Create a new insight record."""
    data = insight.model_dump(exclude_unset=True)
    if isinstance(data.get("created_at"), datetime):
        data["created_at"] = data["created_at"].isoformat()

    response = supabase.table("insights").insert(data).execute()
    return {
        "message": "Insight saved.",
        "insight": response.data[0] if response.data else None,
    }
