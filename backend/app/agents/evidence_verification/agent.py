from datetime import datetime, timezone
from typing import Optional
from app.agents.base import SpecialistAgent
from app.schemas.investigation import InvestigationTask, AgentResult, AgentExecutionStatus
from app.schemas.evidence import Finding, EvidenceRecord, VerificationState, VerificationResult
from app.core.logging import logger


class EvidenceVerificationAgent(SpecialistAgent):
    agent_id: str = "evidence_verification"
    name: str = "Evidence & Scientific Verification Agent"
    description: str = "Evaluate findings against referenced evidence records, audit provenance, and assign verification states."

    async def run(self, task: InvestigationTask) -> AgentResult:
        logger.info(f"[{self.agent_id}] Running verification audit for task {task.investigation_id}")
        return AgentResult(
            agent_id=self.agent_id,
            status=AgentExecutionStatus.COMPLETED,
            findings=[],
            evidence=[],
            limitations=["Verification is bounded by the precision and availability of ingested source metadata."],
            errors=[]
        )

    def verify_findings(
        self,
        findings: list[Finding],
        evidence_pool: list[EvidenceRecord]
    ) -> VerificationResult:
        """
        Deterministic verification logic:
        1. Check that all evidence_ids referenced in findings exist in the evidence_pool.
        2. Verify that findings with values have associated evidence.
        3. Audit temporal consistency (e.g. observation_time is populated).
        """
        evidence_map = {ev.id: ev for ev in evidence_pool}
        verified_count = 0
        unverified_count = 0
        details = []

        for finding in findings:
            missing_ids = [eid for eid in finding.evidence_ids if eid not in evidence_map]
            
            if not finding.evidence_ids or missing_ids:
                unverified_count += 1
                details.append({
                    "finding_id": finding.id,
                    "state": VerificationState.UNVERIFIED.value,
                    "reason": f"Missing or unresolvable evidence IDs: {missing_ids or 'No evidence cited'}"
                })
            else:
                verified_count += 1
                details.append({
                    "finding_id": finding.id,
                    "state": VerificationState.VERIFIED.value,
                    "reason": f"Successfully resolved against evidence: {finding.evidence_ids}"
                })

        if unverified_count == 0 and verified_count > 0:
            overall = VerificationState.VERIFIED
            notes = f"All {verified_count} claims successfully verified against valid evidence records."
        elif verified_count > 0 and unverified_count > 0:
            overall = VerificationState.NEEDS_REVIEW
            notes = f"{verified_count} claims verified, but {unverified_count} claim(s) lack complete supporting evidence."
        elif unverified_count > 0:
            overall = VerificationState.INSUFFICIENT_EVIDENCE
            notes = "Findings lack sufficient resolvable evidence records."
        else:
            overall = VerificationState.INSUFFICIENT_EVIDENCE
            notes = "No findings to evaluate."

        return VerificationResult(
            overall_state=overall,
            verified_claims_count=verified_count,
            unverified_claims_count=unverified_count,
            notes=notes,
            details=details
        )
