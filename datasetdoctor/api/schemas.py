from typing import List, Optional, Any
from pydantic import BaseModel, Field


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
