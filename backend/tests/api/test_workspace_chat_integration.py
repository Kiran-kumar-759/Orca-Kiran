from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.providers.llm.base import LLMProvider


def test_marine_hazard_question_invokes_person2_and_produces_structured_advisory(client):
    """
    Verify:
    1. A marine hazard / fishing question invokes Person 2 (marine_hazard).
    2. Person 2's structured results reach the final response generator.
    3. Evidence references survive the handoff.
    4. Deterministic fallback is correctly labeled when no LLM key is configured.
    5. The final response distinguishes cyclone alerts from sea-state conditions and gives clear guidance.
    """
    payload = {
        "workspace": "fisherman",
        "query": "Is it safe for fishermen near Mangaluru tomorrow morning? Check wave heights and cyclone warnings.",
        "location": {
            "latitude": 12.91,
            "longitude": 74.85,
            "name": "Offshore Mangaluru",
        },
    }

    response = client.post("/api/v1/investigations", json=payload)
    assert response.status_code == 201
    data = response.json()

    # 1. Verification of metadata and status
    assert data["status"] == "completed"
    assert data["is_fallback"] is True
    assert data["provider_used"] == "deterministic_fallback"
    assert data["model_used"] == "deterministic_rule_engine"

    # 2. Person 2 was planned and executed
    events_res = client.get(f"/api/v1/investigations/{data['investigation_id']}/events")
    assert events_res.status_code == 200
    events = events_res.json()
    agent_started_ids = [e.get("agent_id") for e in events if e.get("event_type") == "agent_started"]
    assert "marine_hazard" in agent_started_ids

    # 3. Person 2's findings reach the final response
    findings = data["findings"]
    assert len(findings) > 0
    marine_hazard_findings = [f for f in findings if "gdacs" in f["id"] or "ibtracs" in f["id"] or "wave" in f["id"]]
    assert len(marine_hazard_findings) > 0

    # 4. Evidence references survive handoff
    all_evidence_ids = [e_id for f in findings for e_id in f["evidence_ids"]]
    assert len(all_evidence_ids) > 0

    # 5. Summary is structured, conversational, and adheres to marine safety rules
    summary = data["summary"]
    assert summary is not None
    assert "Direct Assessment for Offshore Mangaluru" in summary or "Direct Assessment for" in summary
    assert "Key Verified Marine Findings" in summary
    assert "Scientific Audit & Disclosures" in summary
    assert "IMD" in summary or "national authorities" in summary
    # Must not claim safe merely because no cyclone was found
    assert "Lack of cyclone alert does not imply calm waves" in summary or "caution" in summary.lower() or "advisory" in summary.lower()


@pytest.mark.asyncio
async def test_workspace_llm_synthesis_with_mocked_provider(client):
    """
    Verify that when an LLM provider is active, the workspace synthesizer passes
    specialist findings to the model and incorporates the grounded response.
    """
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.name = "groq"
    mock_provider.model = "llama-3.3-70b-versatile"
    mock_provider.is_configured = AsyncMock(return_value=True)

    synthesized_llm_text = (
        "### ⚠️ ADVISORY: CAUTION ADVISED OFFSHORE MANGALURU\n\n"
        "**Assessment**: Conditions are unfavorable for small artisanal craft. "
        "Open-Meteo forecasts predict significant wave heights reach 1.8m with moderate sea state [ev-marine-wave-001].\n"
        "- **Active Storms**: No active cyclone alert within 1,500 km detected by GDACS [ev-gdacs-clear].\n"
        "- **Historical Context**: Cyclone Tauktae tracked within 145 km in May 2021 [ev-ibtracs-tauktae].\n"
        "- **Scientific Verification**: Status is `verified` across all cited evidence records.\n"
        "- **Statutory Guidance**: IMD warnings remain mandatory."
    )
    mock_provider.generate_response = AsyncMock(return_value=synthesized_llm_text)

    with patch("app.orchestrator.service.get_active_llm_provider", AsyncMock(return_value=mock_provider)):
        payload = {
            "workspace": "fisherman",
            "query": "Is it safe for fishermen near Mangaluru tomorrow?",
            "location": {"latitude": 12.91, "longitude": 74.85, "name": "Mangaluru Port"},
        }
        res = client.post("/api/v1/investigations", json=payload)
        assert res.status_code == 201
        data = res.json()

        assert data["provider_used"] == "groq"
        assert data["model_used"] == "llama-3.3-70b-versatile"
        assert data["is_fallback"] is False
        assert "CAUTION ADVISED" in data["summary"]
        assert "[ev-marine-wave-001]" in data["summary"]
        assert mock_provider.generate_response.called

        # Ensure specialist findings were passed into the prompt
        call_args = mock_provider.generate_response.call_args
        prompt_content = call_args[0][0]
        assert "SPECIALIST FINDINGS" in prompt_content
        assert "Mangaluru" in prompt_content


@pytest.mark.asyncio
async def test_workspace_llm_provider_failure_graceful_degradation(client):
    """
    Verify that if the active LLM provider fails at runtime (e.g. HTTP 503 / timeout),
    the workspace chatbot does NOT crash, but falls back to deterministic rule engine.
    """
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.name = "groq"
    mock_provider.model = "llama-3.3-70b-versatile"
    mock_provider.is_configured = AsyncMock(return_value=True)
    mock_provider.generate_response = AsyncMock(side_effect=TimeoutError("Groq API 30s timeout"))

    with patch("app.orchestrator.service.get_active_llm_provider", AsyncMock(return_value=mock_provider)):
        payload = {
            "workspace": "fisherman",
            "query": "Wave conditions off Mangaluru tomorrow",
            "location": {"latitude": 12.91, "longitude": 74.85, "name": "Mangaluru"},
        }
        res = client.post("/api/v1/investigations", json=payload)
        assert res.status_code == 201
        data = res.json()

        # Gracefully degraded to deterministic fallback
        assert data["is_fallback"] is True
        assert data["provider_used"] == "deterministic_fallback"
        assert data["model_used"] == "deterministic_rule_engine"
        assert len(data["summary"]) > 50
        assert "Direct Assessment" in data["summary"]


def test_non_marine_question_not_routed_to_person2(client):
    """
    Verify that purely non-marine questions (e.g. population and coastal infrastructure)
    are routed to Coastal Risk, NOT Person 2 (marine_hazard).
    """
    payload = {
        "workspace": "protected_areas",
        "query": "Assess population exposure and coastal settlement infrastructure near the sanctuary buffer.",
        "location": {"latitude": 12.91, "longitude": 74.85, "name": "Coastal Buffer"},
    }

    res = client.post("/api/v1/investigations", json=payload)
    assert res.status_code == 201
    data = res.json()

    events_res = client.get(f"/api/v1/investigations/{data['investigation_id']}/events")
    events = events_res.json()
    started_agents = [e.get("agent_id") for e in events if e.get("event_type") == "agent_started"]

    # Coastal risk should be present, marine_hazard should NOT be forced
    assert "coastal_risk" in started_agents
    assert "marine_hazard" not in started_agents
