from typing import Annotated

from app.db.repositories.hazard_repo import HazardRepository
from app.db.session import get_db
from app.providers.data.ibtracs import IBTrACSClient
from app.schemas.hazard import HazardListResponse, HazardRead
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

router = APIRouter(prefix="/hazards", tags=["Hazards"])


@router.get("", response_model=HazardListResponse)
def list_hazards(
    db: Annotated[Session, Depends(get_db)],
    hazard_type: str | None = Query(None, description="e.g. cyclone, storm_surge"),
    basin: str | None = Query(None, description="e.g. arabian_sea, bay_of_bengal"),
    active_only: bool = Query(False, description="Filter for only active alerts"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Retrieve real marine hazard records and chronological cyclone tracks.
    Queries the PostgreSQL hazard repository; gracefully uses local real datasets if unseeded.
    """
    try:
        repo = HazardRepository(db)
        hazards = repo.list_hazards(
            hazard_type=hazard_type,
            basin=basin,
            active_only=active_only,
            limit=limit,
        )
    except Exception:  # noqa: BLE001
        # Fallback to local verified archive if DB connection is unavailable in environment
        hazards = []

    if not hazards:
        # Load from verified NOAA IBTrACS dataset
        client = IBTrACSClient()
        all_hazards = client.load_local_dataset()
        hazards = [
            h
            for h in all_hazards
            if (not hazard_type or h.type.lower() == hazard_type.lower())
            and (not basin or (h.basin and h.basin.lower() == basin.lower()))
            and (not active_only or h.status == "active")
        ][:limit]

    return HazardListResponse(count=len(hazards), items=hazards)


@router.get("/{hazard_id}", response_model=HazardRead)
def get_hazard(
    hazard_id: str,
    db: Annotated[Session, Depends(get_db)],
):
    """Retrieve detailed track progression for a specific cyclone or hazard event."""
    try:
        repo = HazardRepository(db)
        hazard = repo.get_by_id(hazard_id)
    except Exception:  # noqa: BLE001
        hazard = None

    if not hazard:
        # Check local IBTrACS verified archive
        client = IBTrACSClient()
        all_hazards = client.load_local_dataset()
        matched = [h for h in all_hazards if h.hazard_id == hazard_id]
        if matched:
            hazard = matched[0]

    if not hazard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hazard event '{hazard_id}' was not found.",
        )

    return hazard
