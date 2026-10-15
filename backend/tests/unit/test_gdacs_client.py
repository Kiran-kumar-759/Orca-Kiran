from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from app.providers.data.gdacs import GDACSClient

SAMPLE_GDACS_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "eventtype": "TC",
                "eventid": 1001234,
                "eventname": "HECTOR-26",
                "name": "Tropical Cyclone HECTOR-26",
                "alertlevel": "Orange",
                "alertscore": 2.0,
                "fromdate": "2026-10-14T06:00:00",
                "todate": "2026-10-18T12:00:00",
                "country": "India, Sri Lanka",
                "iscurrent": "true",
                "severitydata": {
                    "severity": 185.0,
                    "severitytext": "Tropical Cyclone (185 km/h)",
                    "severityunit": "km/h",
                },
                "url": {
                    "report": "https://www.gdacs.org/report.aspx?eventid=1001234&eventtype=TC"
                },
            },
            "geometry": {"type": "Point", "coordinates": [73.5, 12.8]},
        }
    ],
}


@pytest.mark.asyncio
async def test_gdacs_client_parses_active_cyclone():
    client = GDACSClient()

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = SAMPLE_GDACS_GEOJSON
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        events = await client.fetch_active_tropical_cyclones()
        assert len(events) == 1
        ev = events[0]
        assert ev.event_id == "gdacs-tc-1001234"
        assert ev.event_name == "HECTOR-26"
        assert ev.alert_level == "Orange"
        assert ev.alert_score == 2.0
        assert ev.severity_kmh == 185.0
        assert ev.is_current is True


@pytest.mark.asyncio
async def test_gdacs_client_handles_timeout():
    client = GDACSClient(timeout_seconds=5)

    with (
        patch(
            "httpx.AsyncClient.get",
            side_effect=httpx.TimeoutException("Connection timed out"),
        ),
        pytest.raises(TimeoutError, match="timed out"),
    ):
        await client.fetch_active_tropical_cyclones()


@pytest.mark.asyncio
async def test_gdacs_client_handles_http_error():
    client = GDACSClient()

    mock_resp = MagicMock()
    mock_resp.status_code = 503
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "503 Service Unavailable", request=AsyncMock(), response=mock_resp
    )

    with (
        patch("httpx.AsyncClient.get", return_value=mock_resp),
        pytest.raises(RuntimeError, match="GDACS API returned status 503"),
    ):
        await client.fetch_active_tropical_cyclones()


@pytest.mark.asyncio
async def test_gdacs_client_handles_empty_response():
    client = GDACSClient()

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"type": "FeatureCollection", "features": []}
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        events = await client.fetch_active_tropical_cyclones()
        assert events == []


@pytest.mark.asyncio
async def test_gdacs_client_handles_malformed_feature_gracefully():
    client = GDACSClient()

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature"},  # Missing properties
                {"type": "Feature", "properties": {}},  # Missing eventid
                {
                    "type": "Feature",
                    "properties": {
                        "eventid": 9999,
                        "eventname": "MALFORMED_DATES",
                        "fromdate": "invalid-iso-date",
                        "todate": "invalid-iso-date",
                    },
                },
            ],
        }
        mock_resp.raise_for_status.return_value = None
        mock_get.return_value = mock_resp

        events = await client.fetch_active_tropical_cyclones()
        assert len(events) == 1
        assert events[0].event_id == "gdacs-tc-9999"
        assert events[0].from_date is None
        assert events[0].to_date is None
