from datetime import UTC, datetime
from typing import Any

import httpx
from app.core.logging import logger
from pydantic import BaseModel


class GDACSEvent(BaseModel):
    event_id: str
    event_name: str
    name: str
    alert_level: str  # Green, Orange, Red
    alert_score: float = 0.0
    from_date: datetime | None = None
    to_date: datetime | None = None
    country: str = ""
    severity_kmh: float | None = None
    severity_text: str = ""
    report_url: str | None = None
    is_current: bool = True
    geometry: dict[str, Any] | None = None


class GDACSClient:
    """
    Client for retrieving active disaster alerts and tropical cyclone tracks from GDACS.
    API: Global Disaster Alert and Coordination System (UN / EU)
    """

    BASE_URL: str = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP"

    def __init__(self, timeout_seconds: int = 15):
        self.timeout = timeout_seconds

    async def fetch_active_tropical_cyclones(self) -> list[GDACSEvent]:
        """
        Fetch currently active tropical cyclones from GDACS.
        Returns a list of normalized GDACSEvent records.
        """
        params = {"eventtype": "TC"}
        logger.info(f"Fetching active tropical cyclones from GDACS ({self.BASE_URL})")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException as exc:
            logger.warning(f"GDACS API request timed out after {self.timeout}s: {exc}")
            raise TimeoutError(
                f"GDACS service request timed out after {self.timeout} seconds."
            ) from exc
        except httpx.HTTPStatusError as exc:
            logger.warning(
                f"GDACS API returned HTTP status {exc.response.status_code}: {exc}"
            )
            raise RuntimeError(
                f"GDACS API returned status {exc.response.status_code}"
            ) from exc
        except Exception as exc:
            logger.warning(f"Failed to fetch data from GDACS: {exc}")
            raise RuntimeError(f"Failed to connect to GDACS service: {exc}") from exc

        events: list[GDACSEvent] = []
        features = data.get("features", [])

        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            event_id = str(props.get("eventid", ""))
            if not event_id:
                continue

            # Parse timestamps
            from_dt = None
            to_dt = None
            if props.get("fromdate"):
                try:
                    from_dt = datetime.fromisoformat(props["fromdate"]).replace(
                        tzinfo=UTC
                    )
                except ValueError:
                    pass
            if props.get("todate"):
                try:
                    to_dt = datetime.fromisoformat(props["todate"]).replace(tzinfo=UTC)
                except ValueError:
                    pass

            # Severity extraction
            sev_data = props.get("severitydata", {})
            severity_kmh = sev_data.get("severity")
            severity_text = sev_data.get("severitytext", "")

            # URL extraction
            urls = props.get("url", {})
            report_url = urls.get("report") if isinstance(urls, dict) else None

            events.append(
                GDACSEvent(
                    event_id=f"gdacs-tc-{event_id}",
                    event_name=props.get("eventname", f"TC-{event_id}"),
                    name=props.get("name", props.get("eventname", "Tropical Cyclone")),
                    alert_level=props.get("alertlevel", "Green"),
                    alert_score=float(props.get("alertscore", 0.0) or 0.0),
                    from_date=from_dt,
                    to_date=to_dt,
                    country=props.get("country", ""),
                    severity_kmh=float(severity_kmh)
                    if severity_kmh is not None
                    else None,
                    severity_text=severity_text,
                    report_url=report_url,
                    is_current=str(props.get("iscurrent", "true")).lower() == "true",
                    geometry=geom if geom else None,
                )
            )

        logger.info(f"Retrieved {len(events)} active cyclone events from GDACS.")
        return events
