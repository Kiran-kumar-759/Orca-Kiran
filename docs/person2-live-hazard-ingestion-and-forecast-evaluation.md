# Person 2 — Marine Hazard & Forecast Agent
## Phase P2-03 Completion Report: Live Marine Hazard Ingestion, PostgreSQL Persistence & Independent Demo UI

**Branch:** `feature/person2-marine-hazard`  
**Database:** PostgreSQL `orca_db` (accessed via application role `orca`)  
**Untouched Databases:** Historical database `orca` (completely untouched, 0 access)  
**Status:** Complete & Independently Verified

---

### 1. Executive Summary

In Phase P2-03, Person 2 (Marine Hazard & Forecast Agent) successfully designed, implemented, and verified a production-grade, repeatable live-hazard ingestion pipeline that connects to the live UN/EU Global Disaster Alert and Coordination System (GDACS) API, normalizes active tropical cyclone alerts, persists them idempotently into PostgreSQL `orca_db`, and exposes them through both the FastAPI query/sync layer and the Person 2 demo UI at `/hazard-demo`.

Historical NOAA IBTrACS data (1,859 historical storms, 62,864 track points) remains 100% intact with zero data loss or relabeling.

In addition, an architectural evaluation of the Open-Meteo Marine Forecast API was conducted. In accordance with project governance rules, wave forecast ingestion has been documented with exact schema requirements and cleanly deferred to the next approved phase to avoid schema corruption or unauthorized shared-contract alteration.

---

### 2. Live GDACS Provider Architecture (`GDACSClient`)

- **Feed Endpoint:** `https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC` (UN / EU Global Disaster Alert and Coordination System).
- **Structure & Filtering:** Real GDACS MAP GeoJSON feeds return hundreds of geographic features (cones, polygon buffers, track lines). The parser specifically identifies `Point_Centroid` features containing event center fixes, alert levels, severity, and report links, while safely handling fallback feature fixtures for unit tests.
- **Normalization & Validation:**
  - **Coordinates:** Enforces strict bounding checks: $-90.0 \le \text{latitude} \le 90.0$ and $-180.0 \le \text{longitude} \le 180.0$. Rejects or flags invalid coordinates with detailed rejection reasons.
  - **Timestamps:** Enforces timezone-aware UTC datetime parsing (`fromdate`, `todate`, `datemodified`).
  - **Intensity:** Converts GDACS source metric ($km/h$) to standard maritime aviation/marine knots ($1\text{ km/h} \approx 0.539957\text{ knots}$) and classifies by alert severity (`Red Alert`, `Orange Alert`, `Green Alert`).
  - **Basin Derivation:** Automatically classifies global coordinates into oceanic basins (`bay_of_bengal`, `arabian_sea`, `south_indian_ocean`, `western_pacific`, `eastern_pacific`, `north_atlantic`, `south_pacific`, or `global`).
  - **Network Resilience:** Implements bounded retries (2 retry attempts with exponential backoff) and HTTP timeouts (15s). Transient errors result in clear `TimeoutError` or `RuntimeError` rather than unhandled crashes or silent empty mocks.

---

### 3. PostgreSQL Persistence & Idempotency Strategy

- **Target Database:** `orca_db` (PostgreSQL 18 on `127.0.0.1:5432`, accessed via application user `orca`).
- **Isolation:** Historical database `orca` is owned by `postgres` and has zero permissions granted to user `orca`. It was not modified, connected to, or imported into.
- **Canonical Model Mapping:** Reuses canonical `Hazard` and `HazardTrack` tables without requiring any Alembic migration or breaking schema changes:
  - **`Hazard`:**
    - `id`: `f"hz-gdacs-tc-{eventid}"` (deterministic unique primary key).
    - `name`: Clean event name (e.g., `Tropical Cyclone SIMON-26`).
    - `hazard_type`: `"cyclone"`.
    - `source`: `"GDACS"`.
    - `status`: `"active"`.
    - `first_observed`: Source `fromdate` (UTC).
    - `last_observed`: Source `todate` or `datemodified` (UTC).
    - `metadata_json`: Provenance metadata including `alert_level`, `alert_score`, `severity_kmh`, `severity_knots`, `report_url`, `source_updated_at`, and `retrieval_timestamp_utc`.
  - **`HazardTrack`:**
    - `id`: `f"hz-gdacs-tc-{eventid}-{int(timestamp)}"` (deterministic timestamp-based primary key).
    - `hazard_id`: References `Hazard.id`.
    - `time`: Fix observation time (UTC).
    - `latitude`, `longitude`: Validated floating-point coordinates.
    - `wind_speed_knots`: Converted sustained wind speed.
    - `category`: `f"{alert_level} Alert"`.
    - `is_forecast`: `False` (actual observed center fix; not a simulated path).
- **Idempotency Guarantee:**
  - Repeated synchronization runs match existing records on primary keys.
  - Updates in-place if source data changed (e.g., higher alert score or updated coordinates).
  - Skips update and increments `unchanged_count` if data is identical.
  - Verified live: Initial sync inserted 5 alerts; immediate second sync reported 0 inserted, 5 unchanged.

---

### 4. Database Population & Row Counts

| Category | Before P2-03 | After P2-03 | Delta / Ingestion Result |
| :--- | :--- | :--- | :--- |
| **Historical Hazards (`NOAA IBTrACS`)** | 1,859 | 1,859 | **0 (Preserved 100%)** |
| **Active Live Alerts (`GDACS`)** | 0 | 5 | **+5 inserted** |
| **Total `hazards` Table Rows** | 1,859 | 1,864 | **+5 rows** |
| **Historical Track Points** | 62,864 | 62,864 | **0 (Preserved 100%)** |
| **Active Centroid Fix Points** | 0 | 5 | **+5 inserted** |
| **Total `hazard_tracks` Table Rows** | 62,864 | 62,869 | **+5 rows** |

#### Live Ingestion Audit Log (Actual GDACS Feed)
- **Features Retrieved from GDACS:** 254
- **Centroids Validated:** 5 active tropical cyclones
  1. `hz-gdacs-tc-1001335` — **Tropical Cyclone SIMON-26** (Orange Alert, 135 kts, Eastern Pacific)
  2. `hz-gdacs-tc-1001338` — **Tropical Cyclone CHAMPI-26** (Orange Alert, 125 kts, Western Pacific)
  3. `hz-gdacs-tc-1001337` — **Tropical Cyclone TRUDY-26** (Green Alert, 115 kts, Eastern Pacific)
  4. `hz-gdacs-tc-1001336` — **Tropical Cyclone TWENTYEIGHT-26** (Green Alert, 30 kts, Western Pacific)
  5. `hz-gdacs-tc-1001333` — **Tropical Cyclone KOGUMA-26** (Green Alert, 120 kts, Western Pacific)
- **Inserted on First Run:** 5
- **Unchanged on Second Run:** 5 (0 duplicates created)
- **Rejected Records:** 0

---

### 5. API Endpoints Reference

All endpoints conform to `/api/v1/hazards`:

1. **Trigger Live Synchronization:**
   - `POST /api/v1/hazards/sync/gdacs`
   - Concurrency-protected via `asyncio.Lock` against accidental browser double-submissions.
   - Returns:
     ```json
     {
       "status": "success",
       "retrieved_count": 254,
       "validated_count": 5,
       "inserted_count": 0,
       "updated_count": 0,
       "unchanged_count": 5,
       "rejected_count": 0,
       "retrieval_timestamp_utc": "2026-10-15T15:07:20.068707Z",
       "message": "Successfully processed 254 features: 0 alerts inserted, 0 updated, 5 unchanged, 0 rejected."
     }
     ```

2. **Check GDACS Provider Status:**
   - `GET /api/v1/hazards/sync/gdacs/status`
   - Returns:
     ```json
     {
       "provider": "GDACS",
       "is_healthy": true,
       "last_sync_utc": "2026-10-15T15:07:13.172240Z",
       "last_sync_status": "active",
       "active_alerts_count": 5,
       "message": "Live feed monitored. 5 active alerts currently tracked in PostgreSQL."
     }
     ```

3. **Query Active Live Alerts:**
   - `GET /api/v1/hazards?status=active`
   - Returns paginated list of active hazards with track points and metadata.

4. **Query Historical Hazards (Preserved):**
   - `GET /api/v1/hazards?basin=arabian_sea&status=historical&limit=20`
   - Returns historical IBTrACS storms.

---

### 6. Marine Hazard Agent Integration (`MarineHazardAgent`)

The specialist agent (`backend/app/agents/marine_hazard/agent.py`) operates independently without requiring the Orchestrator or Evidence Agent:
- Queries `HazardRepository` for persisted active alerts and historical benchmarks.
- Falls back to direct client fetching if no database session is injected.
- Findings explicitly distinguish `Status: ACTIVE` (live disaster alert advisory) from `Status: HISTORICAL` (reanalysis benchmark).
- Each finding includes traceable `EvidenceRecord`s referencing the authoritative UN/EU GDACS or NOAA IBTrACS dataset.
- Does not assert unverified landfall trajectories; findings cite coordinates and note that local landfall depends on official national meteorological warnings.
- Tested standalone in `test_marine_hazard_agent.py` with 100% pass rate.

---

### 7. Person 2 Demo UI (`/hazard-demo`)

The React workspace under `frontend/src/features/hazard-demo/` was expanded with a dedicated live hazard experience:
- **Header:** Features a "Sync Live GDACS" button with spinning loader, live GDACS Online provider status pill, and PostgreSQL row counter.
- **Dual Mode Navigation:**
  - **"Live Alerts" Tab:** Displays cards for each active cyclone with alert level badges (Red, Orange, Green), wind speed, centroid coordinates, and direct links to official GDACS reports.
  - **"Historical" Tab:** Preserves the full Historical Cyclone Explorer with search, basin filters, category filters, and pagination.
- **Interactive Map:**
  - Displays the live centroid fix with a pulsing marker and coordinates tooltip for active alerts (no fabricated paths).
  - Displays full multi-point historical tracks with category colors and start/end markers for historical storms.
- **Detail Panel:** Displays live parameters, official GDACS bulletin URL, and source provenance.
- **Audit Banner:** Shows real ingestion metrics (inserted, updated, unchanged, rejected) upon synchronization.
- **Resilience:** Fallback UI states for loading, empty, and provider errors with safe retry.

---

### 8. Open-Meteo Marine Forecast Evaluation & Schema Requirement

The prompt requested an evaluation of how Open-Meteo Marine wave forecasts fit into the current canonical schema.

#### Technical Analysis:
1. **Nature of the Data:** Open-Meteo Marine (`https://marine-api.open-meteo.com/v1/marine`) returns continuous gridded time-series forecasts: `wave_height`, `wave_direction`, `wave_period`, `wind_wave_height`, and `swell_wave_height` at given latitude/longitude points over 7 days.
2. **Current Schema Mismatch:**
   - In ORCA's database schema, the `hazards` and `hazard_tracks` tables are designed for discrete extreme events (cyclones, storm surges, tsunamis) tied to a named storm identifier (`hazard_id`).
   - Wave forecasts are general oceanographic observations without discrete storm IDs.
   - Forcing wave forecasts into `hazard_tracks` would require fabricating a dummy `Hazard` record and would misrepresent wave grid cells as cyclone track fixes.
   - In ORCA's domain model, wave height and period belong to `marine_observations` (Person 1's domain).
3. **Required Canonical Schema for Forecasts:**
   To persist marine wave forecasts cleanly without conflating them with cyclone tracks or historical observations, a dedicated canonical table is required:
   ```sql
   CREATE TABLE marine_forecasts (
       id VARCHAR(64) PRIMARY KEY,
       reference_time TIMESTAMPTZ NOT NULL,
       forecast_time TIMESTAMPTZ NOT NULL,
       latitude FLOAT NOT NULL,
       longitude FLOAT NOT NULL,
       wave_height_m FLOAT,
       wave_period_s FLOAT,
       wave_direction_deg FLOAT,
       swell_wave_height_m FLOAT,
       wind_speed_knots FLOAT,
       source VARCHAR(64) NOT NULL DEFAULT 'Open-Meteo Marine',
       metadata JSONB DEFAULT '{}'::jsonb
   );
   CREATE INDEX ix_marine_forecasts_coords_time ON marine_forecasts (latitude, longitude, forecast_time);
   ```
4. **Conclusion & Deferral Decision:**
   Introducing `marine_forecasts` requires an Alembic migration and cross-person contract alignment with Person 1 (Marine Data Agent). Therefore, per the prompt's explicit instruction:
   > *"Implement forecast persistence in this phase only if it can be done without misrepresenting observations, corrupting historical records, or introducing incompatible shared-schema changes. Otherwise, document the exact schema requirement and defer forecast ingestion to the next approved Person 2 phase."*

   Forecast persistence is documented here and deferred to the next approved phase.

---

### 9. Verification & Test Summary

- **Backend Pytest Suite:** 45 passed (100% pass rate).
  - 13 API tests in `test_hazards_api.py` (including GDACS sync, idempotency, timeout, and status).
  - 8 integration persistence tests in `test_hazard_persistence.py`.
  - 7 unit tests in `test_gdacs_client.py` (parsing, coordinates, timeouts, retries, deduplication).
  - 7 unit tests in `test_ibtracs_parser.py`.
  - 3 unit tests in `test_marine_hazard_agent.py`.
  - 7 schema, verifier, and health tests.
- **Ruff Lint & Format:** 0 errors (`All checks passed!`).
- **Frontend Vite Build:** `tsc -b && vite build` succeeded in 8.84s (0 errors).
- **Database Safety:** Confirmed database `orca` is untouched and inaccessible.
