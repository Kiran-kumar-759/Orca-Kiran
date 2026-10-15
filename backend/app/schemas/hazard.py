from datetime import datetime

from pydantic import BaseModel, Field


class HazardTrackPoint(BaseModel):
    time: datetime
    latitude: float
    longitude: float
    wind_speed_knots: float | None = None
    pressure_hpa: float | None = None
    category: str | None = None
    is_forecast: bool = False


class HazardRead(BaseModel):
    hazard_id: str
    name: str
    type: str
    source: str
    basin: str | None = None
    status: str
    first_observed: datetime | None = None
    last_observed: datetime | None = None
    track_points: list[HazardTrackPoint] = Field(default_factory=list)


class HazardListResponse(BaseModel):
    count: int
    items: list[HazardRead]


class HazardQueryFilter(BaseModel):
    hazard_type: str | None = None
    basin: str | None = None
    active_only: bool = False
    limit: int = Field(20, ge=1, le=100)
