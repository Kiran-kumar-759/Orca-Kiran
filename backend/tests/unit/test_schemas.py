from datetime import UTC, datetime

from app.schemas.evidence import EvidenceRecord, Finding
from app.schemas.investigation import (
    AgentExecutionStatus,
    AgentResult,
)


def test_evidence_record_validation():
    ev = EvidenceRecord(
        id="ev-test-01",
        dataset_id="open-meteo-marine",
        source_name="Open-Meteo API",
        retrieval_time=datetime.now(UTC),
        latitude=12.91,
        longitude=74.85,
        variable="sea_surface_temperature",
        value=28.5,
        unit="°C",
    )
    assert ev.id == "ev-test-01"
    assert ev.value == 28.5
    assert ev.unit == "°C"


def test_finding_with_evidence():
    f = Finding(
        id="f-01",
        claim="SST measured at 28.5°C",
        value=28.5,
        unit="°C",
        evidence_ids=["ev-test-01"],
        is_forecast=False,
    )
    assert f.evidence_ids == ["ev-test-01"]
    assert f.claim.startswith("SST")


def test_agent_result_schema():
    res = AgentResult(
        agent_id="ocean_research",
        status=AgentExecutionStatus.COMPLETED,
        findings=[],
        evidence=[],
        limitations=["Testing limitation note."],
        errors=[],
    )
    assert res.agent_id == "ocean_research"
    assert res.status == AgentExecutionStatus.COMPLETED
    assert len(res.limitations) == 1
