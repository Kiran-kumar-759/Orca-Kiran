from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from app.agents.marine_hazard.agent import MarineHazardAgent
from app.providers.data.gdacs import GDACSClient
from app.providers.data.ibtracs import IBTrACSClient
from app.schemas.hazard import HazardRead, HazardTrackPoint
from app.schemas.investigation import (
    AgentExecutionStatus,
    InvestigationTask,
    LocationContext,
)


@pytest.fixture
def mock_ibtracs():
    client = IBTrACSClient()
    fake_hazard = HazardRead(
        hazard_id="hz-ibtracs-test-storm",
        name="Cyclone Tauktae",
        type="cyclone",
        source="NOAA IBTrACS",
        basin="arabian_sea",
        status="historical",
        first_observed=datetime(2021, 5, 14, 0, 0, tzinfo=UTC),
        last_observed=datetime(2021, 5, 18, 0, 0, tzinfo=UTC),
        track_points=[
            HazardTrackPoint(
                time=datetime(2021, 5, 15, 6, 0, tzinfo=UTC),
                latitude=13.0,
                longitude=73.5,
                wind_speed_knots=70.0,
                pressure_hpa=980.0,
                category="Category 1",
                is_forecast=False,
            ),
            HazardTrackPoint(
                time=datetime(2021, 5, 16, 12, 0, tzinfo=UTC),
                latitude=15.0,
                longitude=72.8,
                wind_speed_knots=105.0,
                pressure_hpa=950.0,
                category="Category 3",
                is_forecast=False,
            ),
        ],
    )
    client.load_local_dataset = lambda: [fake_hazard]
    return client


@pytest.mark.asyncio
async def test_marine_hazard_agent_end_to_end(mock_ibtracs):
    mock_gdacs = GDACSClient()
    mock_gdacs.fetch_active_tropical_cyclones = AsyncMock(return_value=[])

    agent = MarineHazardAgent(gdacs_client=mock_gdacs, ibtracs_client=mock_ibtracs)
    task = InvestigationTask(
        investigation_id="inv-test-hz-01",
        workspace="disaster-management",
        query="Investigate cyclone risks off Mangaluru port",
        location=LocationContext(latitude=12.91, longitude=74.85, name="Mangaluru"),
    )

    result = await agent.run(task)

    assert result.agent_id == "marine_hazard"
    assert result.status == AgentExecutionStatus.COMPLETED
    assert len(result.findings) >= 2
    assert len(result.evidence) >= 2
    assert len(result.limitations) >= 3

    # Verify that all evidence_ids cited in findings resolve to actual evidence records
    evidence_id_set = {e.id for e in result.evidence}
    for finding in result.findings:
        assert len(finding.evidence_ids) > 0
        for eid in finding.evidence_ids:
            assert eid in evidence_id_set


@pytest.mark.asyncio
async def test_marine_hazard_agent_provider_failure_graceful_handling(mock_ibtracs):
    mock_gdacs = GDACSClient()
    mock_gdacs.fetch_active_tropical_cyclones = AsyncMock(
        side_effect=TimeoutError("GDACS timeout")
    )

    agent = MarineHazardAgent(gdacs_client=mock_gdacs, ibtracs_client=mock_ibtracs)
    task = InvestigationTask(
        investigation_id="inv-test-hz-02",
        workspace="disaster-management",
        query="Check active cyclone warnings",
        location=LocationContext(latitude=14.0, longitude=74.0),
    )

    result = await agent.run(task)

    # Agent should not crash; it should return PARTIAL with limitation recorded
    assert result.status == AgentExecutionStatus.PARTIAL
    assert any("GDACS" in lim for lim in result.limitations)
    assert len(result.errors) > 0
    assert len(result.findings) > 0  # Historical IBTrACS benchmark still succeeded!
