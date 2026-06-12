from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime

class CompetitorBase(BaseModel):
    name: str
    domain: str
    industry: Optional[str] = None
    tracked_keywords: List[str] = []

class CompetitorCreate(CompetitorBase):
    pass

class CompetitorResponse(CompetitorBase):
    id: int
    last_scraped_at: Optional[datetime] = None
    metadata_json: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)

class JobResponse(BaseModel):
    id: int
    competitor_id: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    report_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class ReportResponse(BaseModel):
    id: int
    competitor_id: int
    generated_at: datetime
    summary: Optional[str] = None
    findings: Dict[str, Any] = {}
    raw_sources: List[str] = []
    status: str

    model_config = ConfigDict(from_attributes=True)
