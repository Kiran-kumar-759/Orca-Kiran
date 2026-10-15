from datetime import UTC, datetime

from app.agents.base import SpecialistAgent
from app.core.logging import logger
from app.providers.data.gdacs import GDACSClient, GDACSEvent
from app.providers.data.ibtracs import IBTrACSClient
from app.schemas.evidence import EvidenceRecord, Finding
from app.schemas.hazard import HazardRead
from app.schemas.investigation import (
    AgentExecutionStatus,
    AgentResult,
    InvestigationTask,
)
from app.utils.geo import find_closest_track_point


class MarineHazardAgent(SpecialistAgent):
    agent_id: str = "marine_hazard"
    name: str = "Marine Hazard & Forecast Agent"
    description: str = "Investigate tropical cyclones, storm tracks, surge forecasts, and official weather warnings."

    def __init__(
        self,
        gdacs_client: GDACSClient | None = None,
        ibtracs_client: IBTrACSClient | None = None,
    ):
        self.gdacs_client = gdacs_client or GDACSClient()
        self.ibtracs_client = ibtracs_client or IBTrACSClient()

    async def run(self, task: InvestigationTask) -> AgentResult:
        logger.info(
            f"[{self.agent_id}] Starting investigation for task {task.investigation_id}"
        )
        findings: list[Finding] = []
        evidence: list[EvidenceRecord] = []
        limitations: list[str] = [
            "Historical cyclone tracks are not operational forecasts of future cyclone behavior.",
            "Official localized storm warning signals (1-11) must be verified directly with national authorities.",
            "Positional track uncertainty is ±15 to 30 km for historical best-track observations.",
        ]
        errors: list[str] = []

        now_utc = datetime.now(UTC)
        target_lat = task.location.latitude if task.location else 13.0
        target_lon = task.location.longitude if task.location else 72.0

        provider_failures = 0

        # =====================================================================
        # 1. Live Hazard Check via GDACS
        # =====================================================================
        gdacs_events: list[GDACSEvent] = []
        try:
            gdacs_events = await self.gdacs_client.fetch_active_tropical_cyclones()
        except Exception as e:  # noqa: BLE001
            provider_failures += 1
            err_msg = f"Live GDACS alert service unavailable: {e!s}"
            logger.warning(f"[{self.agent_id}] {err_msg}")
            errors.append(err_msg)
            limitations.append(
                "Could not refresh live global disaster alert notifications from GDACS."
            )

        active_cyclone_found = False
        if gdacs_events:
            for event in gdacs_events:
                ev_id = f"ev-gdacs-{event.event_id}"
                ev_record = EvidenceRecord(
                    id=ev_id,
                    dataset_id="gdacs-tc",
                    source_name="Global Disaster Alert and Coordination System (GDACS)",
                    source_url=event.report_url or "https://www.gdacs.org",
                    retrieval_time=now_utc,
                    observation_time=event.from_date or now_utc,
                    valid_until_time=event.to_date,
                    variable="tropical_cyclone_alert",
                    value={
                        "event_name": event.event_name,
                        "alert_level": event.alert_level,
                        "country": event.country,
                        "severity_kmh": event.severity_kmh,
                    },
                    unit="alert_level",
                    quality_flag="live_advisory",
                    license="Public Domain / UN-EU",
                    metadata={
                        "alert_score": event.alert_score,
                        "is_current": event.is_current,
                    },
                )
                evidence.append(ev_record)

                findings.append(
                    Finding(
                        id=f"f-gdacs-{event.event_id}",
                        claim=(
                            f"Active Tropical Cyclone '{event.event_name}' flagged at {event.alert_level} Alert level "
                            f"by GDACS affecting region ({event.country or 'Marine Sector'})."
                        ),
                        value=event.alert_level,
                        unit="alert_level",
                        evidence_ids=[ev_id],
                        uncertainty="Global disaster coordinate polygon uncertainty",
                        is_forecast=True,
                        observation_time=event.from_date or now_utc,
                    )
                )
                active_cyclone_found = True

        if not active_cyclone_found and not errors:
            ev_id = f"ev-gdacs-clear-{task.investigation_id[:8]}"
            ev_record = EvidenceRecord(
                id=ev_id,
                dataset_id="gdacs-tc",
                source_name="Global Disaster Alert and Coordination System (GDACS)",
                source_url="https://www.gdacs.org",
                retrieval_time=now_utc,
                observation_time=now_utc,
                latitude=target_lat,
                longitude=target_lon,
                variable="active_cyclone_check",
                value="clear",
                unit="status",
                quality_flag="verified_live_query",
                license="Public Domain / UN-EU",
            )
            evidence.append(ev_record)
            findings.append(
                Finding(
                    id=f"f-gdacs-clear-{task.investigation_id[:8]}",
                    claim="No active tropical cyclone warning currently detected in the monitored sector by GDACS.",
                    value="clear",
                    unit="status",
                    evidence_ids=[ev_id],
                    uncertainty="Update cycle latency approximately 3 hours",
                    is_forecast=False,
                    observation_time=now_utc,
                )
            )

        # =====================================================================
        # 2. Historical Cyclone Track Baseline via NOAA IBTrACS
        # =====================================================================
        ibtracs_hazards: list[HazardRead] = []
        try:
            ibtracs_hazards = self.ibtracs_client.load_local_dataset()
        except Exception as e:  # noqa: BLE001
            provider_failures += 1
            err_msg = f"NOAA IBTrACS historical dataset access failure: {e!s}"
            logger.warning(f"[{self.agent_id}] {err_msg}")
            errors.append(err_msg)
            limitations.append("Historical cyclone comparison archive was unreachable.")

        if ibtracs_hazards:
            # Analyze proximity of historical tracks to target coordinates
            closest_storm: HazardRead | None = None
            min_storm_dist = float("inf")
            best_point = None

            for storm in ibtracs_hazards:
                pt, dist = find_closest_track_point(
                    target_lat, target_lon, storm.track_points
                )
                if dist < min_storm_dist:
                    min_storm_dist = dist
                    closest_storm = storm
                    best_point = pt

            if closest_storm and best_point:
                ev_id = f"ev-ibtracs-{closest_storm.hazard_id}"

                # Compute maximum sustained wind and lowest pressure along the track
                max_wind = max(
                    (
                        p.wind_speed_knots
                        for p in closest_storm.track_points
                        if p.wind_speed_knots is not None
                    ),
                    default=None,
                )
                min_pres = min(
                    (
                        p.pressure_hpa
                        for p in closest_storm.track_points
                        if p.pressure_hpa is not None
                    ),
                    default=None,
                )

                ev_record = EvidenceRecord(
                    id=ev_id,
                    dataset_id="noaa-ibtracs",
                    source_name="NOAA International Best Track Archive (IBTrACS v04r01)",
                    source_url="https://www.ncei.noaa.gov/products/international-best-track-archive",
                    retrieval_time=now_utc,
                    observation_time=best_point.time,
                    latitude=best_point.latitude,
                    longitude=best_point.longitude,
                    variable="historical_cyclone_track",
                    value={
                        "storm_name": closest_storm.name,
                        "closest_distance_km": min_storm_dist,
                        "point_wind_knots": best_point.wind_speed_knots,
                        "point_pressure_hpa": best_point.pressure_hpa,
                        "peak_wind_knots": max_wind,
                        "min_pressure_hpa": min_pres,
                    },
                    unit="knots_and_hpa",
                    quality_flag="verified_best_track",
                    license="Public Domain (NOAA NCEI)",
                    metadata={
                        "basin": closest_storm.basin,
                        "first_observed": closest_storm.first_observed.isoformat()
                        if closest_storm.first_observed
                        else None,
                        "last_observed": closest_storm.last_observed.isoformat()
                        if closest_storm.last_observed
                        else None,
                        "total_track_points": len(closest_storm.track_points),
                    },
                )
                evidence.append(ev_record)

                wind_text = f", peak wind of {max_wind} kts" if max_wind else ""
                pres_text = (
                    f", minimum central pressure of {min_pres} hPa" if min_pres else ""
                )

                findings.append(
                    Finding(
                        id=f"f-ibtracs-{closest_storm.hazard_id}",
                        claim=(
                            f"Historical benchmark: {closest_storm.name} tracked within {min_storm_dist:.1f} km "
                            f"of target coordinate ({target_lat:.2f}°N, {target_lon:.2f}°E) on "
                            f"{best_point.time.strftime('%Y-%m-%d %H:%M UTC')}{wind_text}{pres_text}."
                        ),
                        value=min_storm_dist,
                        unit="km",
                        evidence_ids=[ev_id],
                        uncertainty="Best-track interpolation accuracy ±25 km",
                        is_forecast=False,
                        observation_time=best_point.time,
                    )
                )

        # =====================================================================
        # 3. Status Determination
        # =====================================================================
        if provider_failures == 0 and findings:
            status = AgentExecutionStatus.COMPLETED
        elif findings and provider_failures > 0:
            status = AgentExecutionStatus.PARTIAL
        elif not findings and provider_failures > 0:
            status = AgentExecutionStatus.FAILED
        else:
            status = AgentExecutionStatus.COMPLETED

        return AgentResult(
            agent_id=self.agent_id,
            status=status,
            findings=findings,
            evidence=evidence,
            limitations=limitations,
            errors=errors,
        )
