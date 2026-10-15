def test_investigation_creation_and_execution_lifecycle(client):
    payload = {
        "workspace": "fisherman",
        "query": "Fishing offshore Mangaluru tomorrow morning. Check wave and hazard warnings.",
        "location": {
            "latitude": 12.91,
            "longitude": 74.85,
            "name": "Offshore Mangaluru",
        },
    }
    response = client.post("/api/v1/investigations", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "investigation_id" in data
    assert data["status"] == "completed"
    assert len(data["findings"]) > 0
    assert data["verification_summary"]["overall_state"] == "verified"

    inv_id = data["investigation_id"]

    # Test GET investigation status
    get_res = client.get(f"/api/v1/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["investigation_id"] == inv_id

    # Test GET execution events
    events_res = client.get(f"/api/v1/investigations/{inv_id}/events")
    assert events_res.status_code == 200
    events = events_res.json()
    assert len(events) >= 4
    event_types = [e["event_type"] for e in events]
    assert "investigation_started" in event_types
    assert "agent_started" in event_types
    assert "investigation_completed" in event_types

    # Test GET evidence
    ev_res = client.get(f"/api/v1/investigations/{inv_id}/evidence")
    assert ev_res.status_code == 200
    evidence_list = ev_res.json()
    assert len(evidence_list) > 0

    # Test GET report
    rep_res = client.get(f"/api/v1/investigations/{inv_id}/report")
    assert rep_res.status_code == 200
    report_data = rep_res.json()
    assert "markdown_content" in report_data
    assert "ORCA Scientific Intelligence Report" in report_data["markdown_content"]
