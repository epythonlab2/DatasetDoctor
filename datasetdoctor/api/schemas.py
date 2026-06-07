from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_serializer


class Insight(BaseModel):
    task_id: str
    title: str
    category: str
    content: str
    slug: str
    image_url: str
    created_at: Optional[datetime] = None

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime, _info):
        return dt.isoformat() if dt else None


class TargetRequest(BaseModel):
    target: str = Field(..., min_length=1)


class UploadResponse(BaseModel):
    dataset_id: str
    status: str


class CleaningStep(BaseModel):
    action: str  # e.g., "remove_duplicates", "smart_impute", "drop_columns"
    columns: Optional[List[str]] = None
    method: Optional[str] = "auto"


class CleanRequest(BaseModel):
    # New Batch Field
    pipeline: Optional[List[CleaningStep]] = None
    # Maintain legacy fields for single-action compatibility
    action: Optional[str] = "remove_duplicates"
    columns: Optional[List[str]] = None
    method: Optional[str] = "auto"
