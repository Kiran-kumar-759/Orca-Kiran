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
