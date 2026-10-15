from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class MarineObservationRead(BaseModel):
    id: str
    dataset_id: str
    variable: str
    value: float
    unit: str
    latitude: float
    longitude: float
    observation_time: datetime
    retrieval_time: datetime
    is_forecast: bool
    quality_flag: Optional[str] = "good"
    metadata: Optional[dict] = Field(default_factory=dict)


class MarineObservationListResponse(BaseModel):
    count: int
    items: List[MarineObservationRead]


class MarineQueryFilter(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = 50.0
    variable: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = Field(50, ge=1, le=500)
