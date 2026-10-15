from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.evidence import EvidenceRecord, Finding, VerificationResult


class InvestigationReportResponse(BaseModel):
    investigation_id: str
    title: str
    workspace: str
    generated_at: datetime
    markdown_content: str
    findings_count: int
    evidence_count: int
    verification_summary: Optional[VerificationResult] = None
    limitations: List[str] = Field(default_factory=list)
