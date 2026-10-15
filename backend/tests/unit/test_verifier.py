from datetime import datetime, timezone
from app.agents.evidence_verification.agent import EvidenceVerificationAgent
from app.schemas.evidence import Finding, EvidenceRecord, VerificationState


def test_verification_agent_passes_valid_evidence():
    verifier = EvidenceVerificationAgent()
    ev = EvidenceRecord(
        id="ev-01",
        dataset_id="open-meteo-marine",
        source_name="Open-Meteo",
        retrieval_time=datetime.now(timezone.utc),
        variable="wave_height",
        value=1.5,
        unit="m"
    )
    f = Finding(
        id="f-01",
        claim="Wave height is 1.5m",
        value=1.5,
        unit="m",
        evidence_ids=["ev-01"]
    )

    res = verifier.verify_findings(findings=[f], evidence_pool=[ev])
    assert res.overall_state == VerificationState.VERIFIED
    assert res.verified_claims_count == 1
    assert res.unverified_claims_count == 0


def test_verification_agent_detects_missing_evidence():
    verifier = EvidenceVerificationAgent()
    f = Finding(
        id="f-02",
        claim="Unsubstantiated wind speed claim",
        value=35.0,
        unit="knots",
        evidence_ids=["ev-non-existent"]
    )

    res = verifier.verify_findings(findings=[f], evidence_pool=[])
    assert res.overall_state == VerificationState.INSUFFICIENT_EVIDENCE
    assert res.unverified_claims_count == 1
    assert res.verified_claims_count == 0
