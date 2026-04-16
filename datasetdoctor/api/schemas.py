from typing import List, Optional
from pydantic import BaseModel, Field

class TargetRequest(BaseModel):
    target: str = Field(..., min_length=1)

class UploadResponse(BaseModel):
    dataset_id: str
    status: str

class CleanRequest(BaseModel):
    action: str = "remove_duplicates"
    columns: Optional[list] = None
    method: Optional[str] = "auto"
