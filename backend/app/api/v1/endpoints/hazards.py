from datetime import UTC, datetime

from app.schemas.hazard import HazardListResponse, HazardRead, HazardTrackPoint
from fastapi import APIRouter, Query

router = APIRouter(prefix="/hazards", tags=["Hazards"])


@router.get("", response_model=HazardListResponse)
async def list_hazards(
    hazard_type: str | None = Query(None, description="e.g. cyclone, storm_surge"),
    basin: str | None = Query(None, description="e.g. arabian_sea, bay_of_bengal"),
    active_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
):
    """Retrieve historical and active marine hazard tracks."""
    sample_hazards = [
        HazardRead(
            hazard_id="hz-ibtracs-tauktae",
            name="Extremely Severe Cyclonic Storm Tauktae (Historical Replay)",
            type="cyclone",
            source="NOAA IBTrACS",
            basin="arabian_sea",
            status="historical",
            first_observed=datetime(2021, 5, 14, 0, 0, tzinfo=UTC),
            last_observed=datetime(2021, 5, 19, 12, 0, tzinfo=UTC),
            track_points=[
                HazardTrackPoint(
                    time=datetime(2021, 5, 15, 6, 0, tzinfo=UTC),
                    latitude=12.2,
                    longitude=72.8,
                    wind_speed_knots=70.0,
                    pressure_hpa=978.0,
                    category="Category 1",
                    is_forecast=False,
                ),
                HazardTrackPoint(
                    time=datetime(2021, 5, 16, 12, 0, tzinfo=UTC),
                    latitude=14.5,
                    longitude=71.8,
                    wind_speed_knots=105.0,
                    pressure_hpa=950.0,
                    category="Category 3",
                    is_forecast=False,
                ),
                HazardTrackPoint(
                    time=datetime(2021, 5, 17, 18, 0, tzinfo=UTC),
                    latitude=19.2,
                    longitude=71.2,
                    wind_speed_knots=115.0,
                    pressure_hpa=940.0,
                    category="Category 4",
                    is_forecast=False,
                ),
            ],
        )
    ]
    return HazardListResponse(count=len(sample_hazards), items=sample_hazards)
