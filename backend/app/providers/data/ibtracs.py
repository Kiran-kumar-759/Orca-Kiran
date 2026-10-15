import csv
import io
import os
from datetime import UTC, datetime
from typing import Any

import httpx
from app.core.logging import logger
from app.schemas.hazard import HazardRead, HazardTrackPoint


def sshs_to_category(sshs_val: int | None, wind_knots: float | None) -> str:
    """Map Saffir-Simpson Hurricane Scale or wind speed in knots to standardized category."""
    if sshs_val is not None:
        if sshs_val == -1:
            return "Tropical Depression"
        if sshs_val == 0:
            return "Tropical Storm"
        if sshs_val == 1:
            return "Category 1"
        if sshs_val == 2:
            return "Category 2"
        if sshs_val == 3:
            return "Category 3"
        if sshs_val == 4:
            return "Category 4"
        if sshs_val >= 5:
            return "Category 5"

    if wind_knots is not None:
        if wind_knots < 34:
            return "Tropical Depression"
        if wind_knots < 64:
            return "Tropical Storm"
        if wind_knots < 83:
            return "Category 1"
        if wind_knots < 96:
            return "Category 2"
        if wind_knots < 113:
            return "Category 3"
        if wind_knots < 137:
            return "Category 4"
        return "Category 5"

    return "Tropical Cyclone"


class IBTrACSClient:
    """
    Parser and client for NOAA International Best Track Archive for Climate Stewardship (IBTrACS).
    Provider: NOAA National Centers for Environmental Information (NCEI)
    """

    NOAA_NI_CSV_URL: str = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv"

    def __init__(self, sample_filepath: str | None = None):
        self.sample_filepath = sample_filepath or os.path.join(
            "data", "processed", "ibtracs_arabian_sea_sample.csv"
        )

    def parse_csv(self, csv_content: str) -> list[HazardRead]:
        """
        Parses IBTrACS CSV data into chronologically sorted HazardRead models.
        Handles missing values, units, and deduplication.
        """
        f = io.StringIO(csv_content)
        reader = csv.reader(f)

        header = next(reader, None)
        if not header:
            return []

        # Skip units row if present (e.g. contains "Year" or "degrees_north")
        first_row = next(reader, None)
        if first_row and any(
            kw in "".join(first_row) for kw in ["Year", "degrees_north", "kts"]
        ):
            pass  # Successfully skipped metadata/units row
        elif first_row:
            # Re-wrap if first row was actually data
            f = io.StringIO(csv_content)
            reader = csv.reader(f)
            header = next(reader)

        col_map = {col.strip(): idx for idx, col in enumerate(header)}

        # Required columns check
        req_cols = ["SID", "NAME", "ISO_TIME", "LAT", "LON"]
        if not all(c in col_map for c in req_cols):
            logger.warning("IBTrACS CSV missing required columns.")
            return []

        sid_idx = col_map["SID"]
        name_idx = col_map["NAME"]
        time_idx = col_map["ISO_TIME"]
        lat_idx = col_map["LAT"]
        lon_idx = col_map["LON"]
        subbasin_idx = col_map.get("SUBBASIN")
        wmo_wind_idx = col_map.get("WMO_WIND")
        wmo_pres_idx = col_map.get("WMO_PRES")
        usa_wind_idx = col_map.get("USA_WIND")
        usa_pres_idx = col_map.get("USA_PRES")
        sshs_idx = col_map.get("USA_SSHS")

        storms: dict[str, dict[str, Any]] = {}

        for row in reader:
            if len(row) <= max(sid_idx, lat_idx, lon_idx, time_idx):
                continue

            sid = row[sid_idx].strip()
            if not sid:
                continue

            # Parse coordinates
            try:
                lat = float(row[lat_idx].strip())
                lon = float(row[lon_idx].strip())
            except ValueError:
                continue  # Invalid or missing coordinate

            # Parse timestamp
            time_str = row[time_idx].strip()
            try:
                obs_time = datetime.fromisoformat(time_str).replace(tzinfo=UTC)
            except ValueError:
                continue

            # Parse wind speed (prefer WMO_WIND, fallback to USA_WIND)
            wind_knots: float | None = None
            if wmo_wind_idx is not None and row[wmo_wind_idx].strip():
                try:
                    wind_knots = float(row[wmo_wind_idx].strip())
                except ValueError:
                    pass
            if (
                wind_knots is None
                and usa_wind_idx is not None
                and row[usa_wind_idx].strip()
            ):
                try:
                    wind_knots = float(row[usa_wind_idx].strip())
                except ValueError:
                    pass

            # Parse pressure (prefer WMO_PRES, fallback to USA_PRES)
            pres_hpa: float | None = None
            if wmo_pres_idx is not None and row[wmo_pres_idx].strip():
                try:
                    pres_hpa = float(row[wmo_pres_idx].strip())
                except ValueError:
                    pass
            if (
                pres_hpa is None
                and usa_pres_idx is not None
                and row[usa_pres_idx].strip()
            ):
                try:
                    pres_hpa = float(row[usa_pres_idx].strip())
                except ValueError:
                    pass

            # Parse SSHS
            sshs_val: int | None = None
            if sshs_idx is not None and row[sshs_idx].strip():
                try:
                    sshs_val = int(row[sshs_idx].strip())
                except ValueError:
                    pass

            category = sshs_to_category(sshs_val, wind_knots)

            # Subbasin handling (AS = Arabian Sea, BB = Bay of Bengal)
            subbasin = "arabian_sea"
            if subbasin_idx is not None and row[subbasin_idx].strip().upper() == "BB":
                subbasin = "bay_of_bengal"

            raw_name = row[name_idx].strip().title()
            if raw_name.upper() in ["NOT_NAMED", "UNNAMED", ""]:
                storm_name = f"Cyclone {sid}"
            else:
                storm_name = f"Cyclone {raw_name}"

            if sid not in storms:
                storms[sid] = {
                    "hazard_id": f"hz-ibtracs-{sid.lower()}",
                    "name": storm_name,
                    "type": "cyclone",
                    "source": "NOAA IBTrACS",
                    "basin": subbasin,
                    "status": "historical",
                    "track_points": {},
                }

            # Deduplicate by timestamp
            storms[sid]["track_points"][obs_time] = HazardTrackPoint(
                time=obs_time,
                latitude=lat,
                longitude=lon,
                wind_speed_knots=wind_knots,
                pressure_hpa=pres_hpa,
                category=category,
                is_forecast=False,
            )

        hazard_list: list[HazardRead] = []
        for sid, sdata in storms.items():
            # Sort track points chronologically
            sorted_points = [
                pt
                for _, pt in sorted(sdata["track_points"].items(), key=lambda x: x[0])
            ]
            if not sorted_points:
                continue

            first_obs = sorted_points[0].time
            last_obs = sorted_points[-1].time

            hazard_list.append(
                HazardRead(
                    hazard_id=sdata["hazard_id"],
                    name=sdata["name"],
                    type=sdata["type"],
                    source=sdata["source"],
                    basin=sdata["basin"],
                    status=sdata["status"],
                    first_observed=first_obs,
                    last_observed=last_obs,
                    track_points=sorted_points,
                )
            )

        # Sort hazards by latest observation
        hazard_list.sort(
            key=lambda h: h.last_observed or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        return hazard_list

    def load_local_dataset(self) -> list[HazardRead]:
        """Loads and parses the regional Arabian Sea IBTrACS dataset from disk."""
        if not os.path.exists(self.sample_filepath):
            logger.warning(f"IBTrACS sample file not found at {self.sample_filepath}")
            return []

        with open(self.sample_filepath, encoding="utf-8") as f:
            content = f.read()
        return self.parse_csv(content)

    async def fetch_noaa_basin(self) -> list[HazardRead]:
        """Fetches live IBTrACS North Indian Ocean basin CSV from NOAA NCEI."""
        logger.info(f"Downloading IBTrACS data from {self.NOAA_NI_CSV_URL}")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(self.NOAA_NI_CSV_URL, follow_redirects=True)
            resp.raise_for_status()
            return self.parse_csv(resp.text)
