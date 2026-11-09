from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

finding_evidence_link = Table(
    "finding_evidence_link",
    Base.metadata,
    Column(
        "finding_id",
        String(64),
        ForeignKey("findings.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "evidence_id",
        String(64),
        ForeignKey("evidence_records.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class EvidenceRecordModel(Base):
    __tablename__ = "evidence_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("datasets.id"), nullable=False
    )
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    retrieval_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    observation_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    valid_until_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    variable: Mapped[str | None] = mapped_column(String(64), nullable=True)
    value_json: Mapped[dict | None] = mapped_column("value", JSON, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    quality_flag: Mapped[str] = mapped_column(String(32), default="unvalidated")
    license: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)

    dataset = relationship("Dataset")
    findings: Mapped[list["FindingModel"]] = relationship(
        "FindingModel",
        secondary=finding_evidence_link,
        back_populates="evidence_records",
    )

    __table_args__ = (
        Index("ix_evidence_records_lookup", "dataset_id", "observation_time"),
    )


class FindingModel(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    investigation_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[str] = mapped_column(String(64), nullable=False)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    value_json: Mapped[dict | None] = mapped_column("value", JSON, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    uncertainty: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_forecast: Mapped[bool] = mapped_column(default=False)
    observation_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)

    evidence_records: Mapped[list[EvidenceRecordModel]] = relationship(
        EvidenceRecordModel, secondary=finding_evidence_link, back_populates="findings"
    )

    __table_args__ = (Index("ix_findings_investigation", "investigation_id"),)
