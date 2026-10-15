from typing import Any

import httpx
from app.core.config import settings
from app.core.logging import logger


class OpenMeteoMarineClient:
    """Client for retrieving marine conditions from Open-Meteo Marine API."""

    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.OPEN_METEO_BASE_URL

    async def fetch_marine_forecast(
        self,
        latitude: float,
        longitude: float,
        hourly_variables: list[str] | None = None,
    ) -> dict[str, Any]:
        variables = hourly_variables or [
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "swell_wave_height",
        ]
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(variables),
            "timezone": "UTC",
        }

        async with httpx.AsyncClient(
            timeout=settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS
        ) as client:
            logger.info(
                f"Fetching Open-Meteo marine data for ({latitude}, {longitude})"
            )
            response = await client.get(self.base_url, params=params)
            response.raise_for_status()
            return response.json()
