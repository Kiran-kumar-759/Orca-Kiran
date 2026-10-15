# ORCA Data Sources and Integrations

ORCA integrates validated open-access scientific datasets and APIs.

## 1. Candidate Provider Inventory

| Provider / Dataset | Category | Variables / Products | Coverage & Resolution | License / Terms |
|---|---|---|---|---|
| **Open-Meteo Marine API** | Marine Forecast & Observation | Significant wave height, wave direction, wave period, ocean currents, SST, wind speed | Global oceans, 5-10 km grid, hourly | Non-commercial / CC-BY 4.0 with attribution |
| **NOAA IBTrACS** | Tropical Cyclone Tracks | Storm tracks, central pressure, maximum sustained wind, category, basin | Global tropical basins (Arabian Sea, Bay of Bengal), 3-6 hourly historical | Public domain (NOAA NCEI) |
| **GDACS (Global Disaster Alert and Coordination System)** | Multi-Hazard Alerts | Cyclone, tsunami, flood alert levels, impacted population | Global, real-time alerts | Public domain / UN & EU collaboration |
| **Copernicus Marine Service** | High-Res Oceanography | Sea Surface Temperature (OSTIA), Chlorophyll-a, ocean currents | Global & regional European/Indian Ocean grids, daily/monthly | Copernicus Open Access Policy |
| **NASA Ocean Color (MODIS / VIIRS)** | Biogeochemistry | Chlorophyll-a concentration, particulate organic carbon, SST | Global 4km / 9km, daily composites | NASA Open Data Policy |
| **OpenStreetMap / Overpass API** | Coastal Geography | Coastline geometries, ports, harbors, settlements, coastal infrastructure | Global, vector | ODbL (Open Database License) |
| **WorldPop** | Population Geography | 100m gridded population density & count estimates | Country-level (India / Karnataka focus), annual | CC-BY 4.0 |
| **Protected Planet (WDPA)** | Conservation | Marine Protected Area (MPA) polygons, designation status, governance | Global coastal and marine boundaries | UNEP-WCMC non-commercial terms |

---

## 2. Ingestion & Storage Strategy

- **Idempotent Imports:** All ingestion scripts (`scripts/import_*.py`) must check for existing primary keys/fingerprints before writing to PostgreSQL. Running an import script multiple times must never duplicate records.
- **Cache Policy:** External API responses are saved with `retrieval_time` in UTC. Observations older than 24 hours must be marked as cached/historical in the UI.
- **Large Scientific Grids:** Store processed points or regional bounding boxes in PostgreSQL; do not store gigabyte NetCDF rasters directly in database rows.

---

## 3. Implemented Hazard Integrations (Person 2)

### A. NOAA IBTrACS (International Best Track Archive for Climate Stewardship)
- **Official Source:** NOAA National Centers for Environmental Information (NCEI)
- **Live Endpoint / Basin CSV:** `https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv`
- **Repository Sample:** `data/processed/ibtracs_arabian_sea_sample.csv` (Extracted Arabian Sea tracks, e.g. Cyclone Tauktae 2021)
- **Coverage:** North Indian Ocean basin (NI), Arabian Sea (AS), Bay of Bengal (BB) from 1848 to present; 3-hour to 6-hour intervals.
- **Fields Extracted:**
  - `SID`: Unique storm identifier (e.g., `2021133N10071`)
  - `NAME`: System name (e.g., `TAUKTAE`)
  - `ISO_TIME`: UTC observation timestamp (`YYYY-MM-DD HH:MM:SS`)
  - `LAT`, `LON`: Decimal degrees North/East
  - `WMO_WIND`: Maximum sustained wind in knots (`kts`)
  - `WMO_PRES`: Central pressure in hectopascals / millibars (`mb`/`hPa`)
  - `USA_SSHS`: Saffir-Simpson Hurricane Wind Scale category (-1 to 5)
- **Units:** Wind speed in knots (`kts`), pressure in hectopascals (`hPa`), coordinates in WGS84 decimal degrees.
- **Limitations:**
  - Historical archive only; cannot be used as real-time forecasts.
  - Intermediate track points may have missing pressure or wind observations (handled gracefully by storing `None`).
  - Pre-satellite observations (prior to 1970) have higher track uncertainty.

### B. GDACS (Global Disaster Alert and Coordination System)
- **Official Source:** United Nations (OCHA) & European Commission (DG ECHO / JRC)
- **Live Endpoint:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC`
- **Coverage:** Global oceans and coastal regions, real-time active tropical cyclones and official alerts.
- **Fields Extracted:**
  - `eventid`: Unique GDACS event number (e.g. `1001234`)
  - `eventname` / `name`: Storm designation (e.g. `HECTOR-26`)
  - `alertlevel`: Official warning level (`Green`, `Orange`, `Red`)
  - `alertscore`: Calculated severity score (0.0 to 3.0)
  - `fromdate`, `todate`: UTC event validity window
  - `severitydata.severity`: Peak wind speed in kilometers per hour (`km/h`)
  - `country`: Affected countries / coastlines
  - `geometry`: GeoJSON Point coordinates of latest position
- **Units:** Wind speed in `km/h`, coordinates in WGS84 decimal degrees.
- **Limitations:**
  - Dependent on international warning centers (JTWC, IMD, JMA) feeds into GDACS.
  - Active cyclone events only exist when storms are currently monitored; empty returns indicate zero active cyclones globally or regionally.
  - HTTP requests require explicit timeouts and graceful fallback if external services are unreachable.
