from datetime import UTC

import pytest

from app.providers.data.open_meteo import OpenMeteoMarineClient

SAMPLE_OPEN_METEO_RESPONSE = {
    "latitude": 12.875,
    "longitude": 74.79167,
    "generationtime_ms": 0.18,
    "utc_offset_seconds": 0,
    "timezone": "GMT",
    "timezone_abbreviation": "GMT",
    "elevation": 53.0,
    "hourly_units": {
        "time": "iso8601",
        "wave_height": "m",
        "wave_direction": "°",
        "wave_period": "s",
        "wind_wave_height": "m",
        "swell_wave_height": "m",
    },
    "hourly": {
        "time": ["2026-10-15T00:00", "2026-10-15T01:00", "2026-10-15T02:00"],
        "wave_height": [0.65, 0.70, None],
        "wave_direction": [245.0, 248.0, 250.0],
        "wave_period": [8.2, 8.4, 8.1],
        "wind_wave_height": [0.35, 0.40, 0.38],
        "swell_wave_height": [0.55, 0.58, 0.52],
    },
}


def test_open_meteo_client_validates_coordinates():
    client = OpenMeteoMarineClient()
    client.validate_coordinates(12.91, 74.85)

    with pytest.raises(ValueError, match="Latitude 95.0 out of bounds"):
        client.validate_coordinates(95.0, 74.85)

    with pytest.raises(ValueError, match="Longitude -190.0 out of bounds"):
        client.validate_coordinates(12.91, -190.0)


def test_open_meteo_client_normalizes_response_and_utc():
    client = OpenMeteoMarineClient()
    points = client.normalize_forecast_response(
        raw_data=SAMPLE_OPEN_METEO_RESPONSE,
        requested_lat=12.91,
        requested_lon=74.85,
    )

    assert len(points) == 3
    p0 = points[0]
    assert p0.provider == "open-meteo-marine"
    assert p0.latitude == 12.875
    assert p0.longitude == 74.79167
    assert p0.valid_time.tzinfo == UTC
    assert p0.valid_time.hour == 0
    assert p0.wave_height_m == 0.65
    assert p0.wave_direction_deg == 245.0
    assert p0.wave_period_s == 8.2

    # Verify None is preserved for missing value at index 2
    p2 = points[2]
    assert p2.wave_height_m is None
    assert p2.wave_period_s == 8.1


def test_open_meteo_client_handles_malformed_response():
    client = OpenMeteoMarineClient()
    with pytest.raises(ValueError, match="missing 'hourly.time'"):
        client.normalize_forecast_response({"hourly": {}}, 12.91, 74.85)


@pytest.mark.asyncio
async def test_open_meteo_client_handles_429_retry_after():
    from unittest.mock import AsyncMock, MagicMock, patch

    client = OpenMeteoMarineClient(max_retries=1)

    mock_429 = MagicMock()
    mock_429.status_code = 429
    mock_429.headers = {"Retry-After": "1"}

    mock_200 = MagicMock()
    mock_200.status_code = 200
    mock_200.json.return_value = SAMPLE_OPEN_METEO_RESPONSE

    with (
        patch("httpx.AsyncClient.get", side_effect=[mock_429, mock_200]),
        patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep,
    ):
        data = await client.fetch_marine_forecast(12.91, 74.85, 3)
        assert data["latitude"] == 12.875
        mock_sleep.assert_awaited_once_with(1.0)


@pytest.mark.asyncio
async def test_open_meteo_client_handles_malformed_json():
    from unittest.mock import MagicMock, patch

    client = OpenMeteoMarineClient(max_retries=1)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.side_effect = ValueError("Malformed JSON payload")

    with (
        patch("httpx.AsyncClient.get", return_value=mock_resp),
        pytest.raises(ValueError, match="malformed JSON"),
    ):
        await client.fetch_marine_forecast(12.91, 74.85, 3)


@pytest.mark.asyncio
async def test_open_meteo_client_non_retryable_4xx():
    from unittest.mock import MagicMock, patch

    client = OpenMeteoMarineClient(max_retries=2)
    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = "Bad Request: Invalid parameters"

    with (
        patch("httpx.AsyncClient.get", return_value=mock_resp),
        pytest.raises(ValueError, match="client error 400"),
    ):
        await client.fetch_marine_forecast(12.91, 74.85, 3)
