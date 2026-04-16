from pydantic import BaseModel, Field
from typing import Optional, List


class TargetRequest(BaseModel):
    target: str = Field(..., min_length=1)


class UploadResponse(BaseModel):
    dataset_id: str
    status: str


class CleanRequest(BaseModel):
    action: str = "remove_duplicates"
    columns: Optional[List] = None
    method: Optional[str] = "auto"
