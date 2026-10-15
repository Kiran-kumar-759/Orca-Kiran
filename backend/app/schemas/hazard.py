from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class HazardTrackPoint(BaseModel):
    time: datetime
    latitude: float
    longitude: float
    wind_speed_knots: Optional[float] = None
    pressure_hpa: Optional[float] = None
    category: Optional[str] = None
    is_forecast: bool = False


class HazardRead(BaseModel):
    hazard_id: str
    name: str
    type: str
    source: str
    basin: Optional[str] = None
    status: str
    first_observed: Optional[datetime] = None
    last_observed: Optional[datetime] = None
    track_points: List[HazardTrackPoint] = Field(default_factory=list)


class HazardListResponse(BaseModel):
    count: int
    items: List[HazardRead]


class HazardQueryFilter(BaseModel):
    hazard_type: Optional[str] = None
    basin: Optional[str] = None
    active_only: bool = False
    limit: int = Field(20, ge=1, le=100)
