from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, DateTime, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class GeographicFeature(Base):
    __tablename__ = "geographic_features"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_type: Mapped[str] = mapped_column(String(64), nullable=False)  # settlement, port, hospital, protected_area
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # e.g. Karnataka, Kerala, Goa
    population: Mapped[Optional[int]] = mapped_column(nullable=True)
    properties: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    geometry_geojson: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # GeoJSON polygon/multipolygon
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_geo_features_type_lat_lon", "feature_type", "latitude", "longitude"),
    )
