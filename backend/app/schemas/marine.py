from datetime import datetime

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
    quality_flag: str | None = "good"
    metadata: dict | None = Field(default_factory=dict)


class MarineObservationListResponse(BaseModel):
    count: int
    items: list[MarineObservationRead]


class MarineQueryFilter(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    radius_km: float | None = 50.0
    variable: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    limit: int = Field(50, ge=1, le=500)
