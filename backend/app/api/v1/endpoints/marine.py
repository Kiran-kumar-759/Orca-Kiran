from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Query
from app.schemas.marine import MarineObservationListResponse, MarineObservationRead

router = APIRouter(prefix="/marine", tags=["Marine"])


@router.get("/observations", response_model=MarineObservationListResponse)
async def get_marine_observations(
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0),
    radius_km: Optional[float] = Query(50.0, ge=1.0, le=500.0),
    variable: Optional[str] = Query(None, description="e.g. sst, wave_height, wind_speed"),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=500)
):
    """Retrieve filtered marine observations and forecast variables."""
    # Architectural default dataset representation
    sample_items = [
        MarineObservationRead(
            id="obs-om-001",
            dataset_id="open-meteo-marine",
            variable=variable or "wave_height",
            value=1.8,
            unit="m",
            latitude=latitude or 12.91,
            longitude=longitude or 74.85,
            observation_time=datetime.now(timezone.utc),
            retrieval_time=datetime.now(timezone.utc),
            is_forecast=True,
            quality_flag="good",
            metadata={"source": "Open-Meteo Global Marine"}
        )
    ]
    return MarineObservationListResponse(count=len(sample_items), items=sample_items)
