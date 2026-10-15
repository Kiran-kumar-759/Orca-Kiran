from datetime import UTC

from app.models.hazard import Hazard, HazardTrack
from app.schemas.hazard import HazardRead, HazardTrackPoint
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


class HazardRepository:
    """Repository for querying and persisting Hazard and HazardTrack database records."""

    def __init__(self, session: Session):
        self.session = session

    def list_hazards(
        self,
        hazard_type: str | None = None,
        basin: str | None = None,
        active_only: bool = False,
        limit: int = 20,
    ) -> list[HazardRead]:
        """Query hazards with optional filters and chronologically ordered track points."""
        stmt = select(Hazard).options(selectinload(Hazard.track_points)).limit(limit)

        if hazard_type:
            stmt = stmt.where(Hazard.hazard_type == hazard_type.lower().strip())
        if basin:
            stmt = stmt.where(Hazard.basin == basin.lower().strip())
        if active_only:
            stmt = stmt.where(Hazard.status == "active")

        # Order by latest observed or created_at descending
        stmt = stmt.order_by(Hazard.last_observed.desc().nullslast())

        results = self.session.scalars(stmt).all()
        return [self._to_schema(h) for h in results]

    def get_by_id(self, hazard_id: str) -> HazardRead | None:
        """Fetch a single hazard by its unique identifier."""
        stmt = (
            select(Hazard)
            .options(selectinload(Hazard.track_points))
            .where(Hazard.id == hazard_id)
        )
        hazard = self.session.scalars(stmt).first()
        return self._to_schema(hazard) if hazard else None

    def upsert_hazard(
        self,
        hazard_read: HazardRead,
        metadata_json: dict | None = None,
    ) -> Hazard:
        """
        Idempotently create or update a Hazard and its HazardTracks.
        Prevents primary key collision and ensures idempotent re-runs.
        """
        stmt = (
            select(Hazard)
            .options(selectinload(Hazard.track_points))
            .where(Hazard.id == hazard_read.hazard_id)
        )
        existing = self.session.scalars(stmt).first()
        if not existing:
            existing = Hazard(
                id=hazard_read.hazard_id,
                name=hazard_read.name,
                hazard_type=hazard_read.type,
                source=hazard_read.source,
                basin=hazard_read.basin,
                status=hazard_read.status,
                first_observed=hazard_read.first_observed,
                last_observed=hazard_read.last_observed,
                metadata_json=metadata_json or {},
            )
            self.session.add(existing)
            self.session.flush()
        else:
            existing.name = hazard_read.name
            existing.status = hazard_read.status
            existing.first_observed = hazard_read.first_observed
            existing.last_observed = hazard_read.last_observed

        # Track points deduplication by hazard_id and track_id
        existing_track_ids = {tp.id for tp in existing.track_points}

        for idx, pt in enumerate(hazard_read.track_points):
            pt_time = pt.time if pt.time.tzinfo else pt.time.replace(tzinfo=UTC)
            track_id = f"{existing.id}-pt-{idx:04d}-{int(pt_time.timestamp())}"
            if track_id not in existing_track_ids:
                track_record = HazardTrack(
                    id=track_id,
                    hazard_id=existing.id,
                    time=pt_time,
                    latitude=pt.latitude,
                    longitude=pt.longitude,
                    wind_speed_knots=pt.wind_speed_knots,
                    pressure_hpa=pt.pressure_hpa,
                    category=pt.category,
                    is_forecast=pt.is_forecast,
                )
                self.session.add(track_record)
                existing_track_ids.add(track_id)

        self.session.commit()
        return existing

    def _to_schema(self, hazard: Hazard) -> HazardRead:
        """Map SQLAlchemy Hazard model to HazardRead schema."""
        # Chronologically sort track points
        sorted_points = sorted(hazard.track_points, key=lambda p: p.time)
        track_points_schema = [
            HazardTrackPoint(
                time=tp.time,
                latitude=tp.latitude,
                longitude=tp.longitude,
                wind_speed_knots=tp.wind_speed_knots,
                pressure_hpa=tp.pressure_hpa,
                category=tp.category,
                is_forecast=tp.is_forecast,
            )
            for tp in sorted_points
        ]

        return HazardRead(
            hazard_id=hazard.id,
            name=hazard.name,
            type=hazard.hazard_type,
            source=hazard.source,
            basin=hazard.basin,
            status=hazard.status,
            first_observed=hazard.first_observed,
            last_observed=hazard.last_observed,
            track_points=track_points_schema,
        )
