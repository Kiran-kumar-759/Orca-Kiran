from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, DateTime, ForeignKey, Index, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class InvestigationModel(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace: Mapped[str] = mapped_column(String(64), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, running, completed, failed
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location_json: Mapped[Optional[dict]] = mapped_column("location", JSON, nullable=True)
    time_window_json: Mapped[Optional[dict]] = mapped_column("time_window", JSON, nullable=True)
    limitations: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    events: Mapped[List["ExecutionEventModel"]] = relationship(
        "ExecutionEventModel",
        back_populates="investigation",
        cascade="all, delete-orphan",
        order_by="ExecutionEventModel.timestamp"
    )
    findings: Mapped[List["FindingModel"]] = relationship(
        "FindingModel",
        cascade="all, delete-orphan"
    )
    verification: Mapped[Optional["VerificationModel"]] = relationship(
        "VerificationModel",
        back_populates="investigation",
        uselist=False,
        cascade="all, delete-orphan"
    )


class ExecutionEventModel(Base):
    __tablename__ = "execution_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    investigation_id: Mapped[str] = mapped_column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    investigation: Mapped["InvestigationModel"] = relationship("InvestigationModel", back_populates="events")

    __table_args__ = (
        Index("ix_execution_events_investigation_time", "investigation_id", "timestamp"),
    )


class VerificationModel(Base):
    __tablename__ = "verifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    investigation_id: Mapped[str] = mapped_column(String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False)  # verified, unverified, needs_review, conflicting, insufficient_evidence
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    verified_claims_count: Mapped[int] = mapped_column(default=0)
    unverified_claims_count: Mapped[int] = mapped_column(default=0)
    audit_details: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    investigation: Mapped["InvestigationModel"] = relationship("InvestigationModel", back_populates="verification")
