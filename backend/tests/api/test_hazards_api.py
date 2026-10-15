def test_get_hazards_list(client):
    response = client.get("/api/v1/hazards")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "items" in data
    assert data["count"] >= 1
    hazard = data["items"][0]
    assert "hazard_id" in hazard
    assert "name" in hazard
    assert "track_points" in hazard
    assert len(hazard["track_points"]) > 0


def test_get_hazards_filter_by_basin(client):
    response = client.get("/api/v1/hazards?basin=arabian_sea")
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["basin"] == "arabian_sea"


def test_get_specific_hazard_by_id(client):
    # First get the hazard ID from list
    list_res = client.get("/api/v1/hazards")
    first_id = list_res.json()["items"][0]["hazard_id"]

    res = client.get(f"/api/v1/hazards/{first_id}")
    assert res.status_code == 200
    storm = res.json()
    assert storm["hazard_id"] == first_id
    assert len(storm["track_points"]) > 0


def test_get_unknown_hazard_returns_404(client):
    res = client.get("/api/v1/hazards/hz-non-existent-storm-999")
    assert res.status_code == 404
