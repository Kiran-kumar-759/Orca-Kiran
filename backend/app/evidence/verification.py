from app.schemas.evidence import Finding, EvidenceRecord, VerificationResult
from app.agents.evidence_verification.agent import EvidenceVerificationAgent


def run_scientific_verification(
    findings: list[Finding],
    evidence: list[EvidenceRecord]
) -> VerificationResult:
    """Helper to execute verification using the Evidence Verification Agent."""
    verifier = EvidenceVerificationAgent()
    return verifier.verify_findings(findings=findings, evidence_pool=evidence)
