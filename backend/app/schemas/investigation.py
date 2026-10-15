from datetime import datetime
from enum import Enum
from typing import Any, Optional, List
from pydantic import BaseModel, Field
from app.schemas.evidence import EvidenceRecord, Finding, VerificationResult


class AgentExecutionStatus(str, Enum):
    COMPLETED = "completed"
    PARTIAL = "partial"
    UNAVAILABLE = "unavailable"
    FAILED = "failed"


class EventType(str, Enum):
    INVESTIGATION_STARTED = "investigation_started"
    AGENT_STARTED = "agent_started"
    TOOL_COMPLETED = "tool_completed"
    EVIDENCE_ADDED = "evidence_added"
    AGENT_COMPLETED = "agent_completed"
    VERIFICATION_FAILED = "verification_failed"
    VERIFICATION_PASSED = "verification_passed"
    INVESTIGATION_COMPLETED = "investigation_completed"


class LocationContext(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    name: Optional[str] = None
    radius_km: Optional[float] = 50.0


class TimeWindow(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class InvestigationTask(BaseModel):
    investigation_id: str
    workspace: str
    query: str
    location: Optional[LocationContext] = None
    time_window: Optional[TimeWindow] = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class AgentResult(BaseModel):
    agent_id: str
    status: AgentExecutionStatus
    findings: List[Finding] = Field(default_factory=list)
    evidence: List[EvidenceRecord] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class InvestigationCreate(BaseModel):
    workspace: str = Field(..., description="Target workspace: fisherman, marine_monitoring, protected_areas, coastal_authority, disaster_management")
    query: str = Field(..., min_length=3, description="User investigation question")
    location: Optional[LocationContext] = None
    time_window: Optional[TimeWindow] = None
    preferred_agents: Optional[List[str]] = None


class InvestigationCreateResponse(BaseModel):
    investigation_id: str
    status: str
    workspace: str
    created_at: datetime
    message: str


class ExecutionEvent(BaseModel):
    id: str
    investigation_id: str
    agent_id: Optional[str] = None
    event_type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime


class InvestigationResponse(BaseModel):
    investigation_id: str
    workspace: str
    status: str
    query: str
    summary: Optional[str] = None
    location: Optional[LocationContext] = None
    time_window: Optional[TimeWindow] = None
    findings: List[Finding] = Field(default_factory=list)
    verification_summary: Optional[VerificationResult] = None
    limitations: List[str] = Field(default_factory=list)
    created_at: datetime
    completed_at: Optional[datetime] = None
