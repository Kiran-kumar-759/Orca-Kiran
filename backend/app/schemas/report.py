from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.evidence import VerificationResult


class InvestigationReportResponse(BaseModel):
    investigation_id: str
    title: str
    workspace: str
    generated_at: datetime
    markdown_content: str
    findings_count: int
    evidence_count: int
    verification_summary: VerificationResult | None = None
    limitations: list[str] = Field(default_factory=list)
