from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, DateTime, Boolean, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class MarineObservation(Base):
    __tablename__ = "marine_observations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64), ForeignKey("datasets.id"), nullable=False)
    variable: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. sst, wave_height, wind_speed
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. °C, m, m/s
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    observation_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    retrieval_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    is_forecast: Mapped[bool] = mapped_column(Boolean, default=False)
    quality_flag: Mapped[Optional[str]] = mapped_column(String(32), default="good")
    metadata_json: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)

    dataset = relationship("Dataset")

    __table_args__ = (
        Index("ix_marine_obs_time_lat_lon", "observation_time", "latitude", "longitude"),
        Index("ix_marine_obs_variable", "variable"),
    )
