from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    license: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    temporal_coverage: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    spatial_coverage: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    variables: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
