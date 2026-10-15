from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union
from pydantic import BaseModel, Field


class VerificationState(str, Enum):
    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    NEEDS_REVIEW = "needs_review"
    CONFLICTING = "conflicting"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class EvidenceRecord(BaseModel):
    id: str = Field(..., description="Unique immutable evidence identifier, e.g. ev-om-001")
    dataset_id: str = Field(..., description="Provider dataset identifier")
    source_name: str = Field(..., description="Human-readable provider name")
    source_url: Optional[str] = None
    retrieval_time: datetime = Field(..., description="UTC timestamp when data was fetched")
    observation_time: Optional[datetime] = Field(None, description="UTC timestamp of the observation")
    valid_until_time: Optional[datetime] = Field(None, description="UTC timestamp for forecast validity window")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coverage_area: Optional[str] = None
    variable: Optional[str] = None
    value: Optional[Union[float, int, str, dict, list]] = None
    unit: Optional[str] = None
    quality_flag: str = "unvalidated"
    license: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Finding(BaseModel):
    id: str = Field(..., description="Finding identifier, e.g. f-001")
    claim: str = Field(..., description="Structured statement or observation finding")
    value: Optional[Union[float, int, str, dict]] = None
    unit: Optional[str] = None
    evidence_ids: list[str] = Field(default_factory=list, description="Referenced evidence records")
    uncertainty: Optional[str] = None
    is_forecast: bool = False
    observation_time: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class VerificationResult(BaseModel):
    overall_state: VerificationState
    verified_claims_count: int = 0
    unverified_claims_count: int = 0
    notes: str = ""
    details: list[dict[str, Any]] = Field(default_factory=list)
