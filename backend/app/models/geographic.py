from datetime import UTC, datetime

from app.db.base import Base
from sqlalchemy import JSON, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column


class GeographicFeature(Base):
    __tablename__ = "geographic_features"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_type: Mapped[str] = mapped_column(
        String(64), nullable=False
    )  # settlement, port, hospital, protected_area
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )  # e.g. Karnataka, Kerala, Goa
    population: Mapped[int | None] = mapped_column(nullable=True)
    properties: Mapped[dict | None] = mapped_column(JSON, default=dict)
    geometry_geojson: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # GeoJSON polygon/multipolygon
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    __table_args__ = (
        Index("ix_geo_features_type_lat_lon", "feature_type", "latitude", "longitude"),
    )
