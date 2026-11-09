# Person 2 Database Inventory & Export Plan: Marine Hazard & Forecast Intelligence

**Target Application Database:** `orca_db` (PostgreSQL 18.6)  
**Protected Historical Database:** `orca` (**STRICTLY UNTOUCHED & PROHIBITED**)  
**Export Date:** 2026-10-17  
**Dump Path:** `handoff/person2/person2_database.dump` (Custom Format `-Fc`, 889,237 bytes)  
**Alembic Head Revision:** `a1d8b97152ca`  

---

## 1. Table Inventory & Ownership Classification

An inspection of `orca_db` confirms a total of 15 tables. The tables have been partitioned into **Person 2 Owned Tables** (populated with verified scientific and hazard data) and **Shared / Teammate Tables** (platform contracts currently empty in this workspace).

### A. Person 2 Owned & Populated Tables (Included in Export)

| Table Name | Row Count | Primary Key | Foreign Keys | Purpose & Ownership Justification |
|------------|-----------|-------------|--------------|-----------------------------------|
| `hazards` | 1,865 | `id` (VARCHAR(64)) | None | **Person 2 Core Domain:** Stores historical tropical cyclones from NOAA IBTrACS (1980–present) across the North Indian Ocean (Arabian Sea and Bay of Bengal), along with active cyclone alerts synchronized from GDACS. |
| `hazard_tracks` | 62,874 | `id` (VARCHAR(64)) | `hazard_id` $\rightarrow$ `hazards.id` | **Person 2 Core Domain:** Stores chronological coordinate track points (latitude, longitude, time, wind speed in knots, pressure in hPa, Saffir-Simpson/IMD category) for historical and active cyclones. |
| `marine_forecasts` | 387 | `id` (VARCHAR(64)) | None | **Person 2 Core Domain:** Stores numerical gridded marine forecasts ingested from Open-Meteo Marine (hourly valid times, significant wave height, peak wave period, wave direction, wind wave height, swell wave height) for key coastal sectors (Mangaluru, Chennai, Mumbai, Kochi, etc.). |
| `cyclone_forecast_runs` | 4 | `id` (VARCHAR(64)) | None | **Person 2 Core Domain:** Stores operational tropical cyclone forecast advisory runs ingested from NOAA National Hurricane Center (NHC). |
| `cyclone_forecast_positions` | 27 | `id` (VARCHAR(64)) | `forecast_run_id` $\rightarrow$ `cyclone_forecast_runs.id` | **Person 2 Core Domain:** Stores predicted future track waypoints (lead time hours 0 to 120h, valid times, coordinates, max wind, wind gusts, minimum pressure, classification) for active forecast runs. |
| `alembic_version` | 1 | `version_num` | None | **Migration Tracker:** Records applied migration state (`a1d8b97152ca`). |

### B. Shared Platform & Other Agent Tables (Excluded from Export)

| Table Name | Row Count | Primary Key | Foreign Keys | Ownership & Reason for Exclusion |
|------------|-----------|-------------|--------------|----------------------------------|
| `datasets` | 0 | `id` | None | Shared platform dataset catalog (Person 1 / Core). Excluded because Person 2 does not write canonical dataset entities directly to this table. |
| `evidence_records` | 0 | `id` | `dataset_id` $\rightarrow$ `datasets.id` | Shared platform evidence repository (Verification Agent / Person 4). Excluded; Person 2 returns in-memory Pydantic `EvidenceRecord` objects in chat/analysis responses. |
| `investigations` | 0 | `id` | None | Shared Orchestrator multi-agent investigations table. Excluded; managed by Orchestrator service. |
| `execution_events` | 0 | `id` | `investigation_id` $\rightarrow$ `investigations.id` | Shared Orchestrator execution event timeline. Excluded. |
| `findings` | 0 | `id` | `investigation_id` $\rightarrow$ `investigations.id` | Shared Orchestrator scientific findings table. Excluded; returned dynamically via API. |
| `finding_evidence_link` | 0 | Composite (`finding_id`, `evidence_id`) | Multiple | Shared link table. Excluded. |
| `geographic_features` | 0 | `id` | None | Person 3 Coastal Authority GIS features table. Excluded. |
| `marine_observations` | 0 | `id` | `dataset_id` $\rightarrow$ `datasets.id` | Person 1 Marine Monitoring in-situ observation table. Excluded. |
| `verifications` | 0 | `id` | `investigation_id` $\rightarrow$ `investigations.id` | Verification Agent verification audits table. Excluded. |

---

## 2. Table Schemas, Constraints & Indexes

### 1. `hazards`
- **Columns:**
  - `id`: `VARCHAR(64)` NOT NULL (PK)
  - `name`: `VARCHAR(255)` NOT NULL
  - `hazard_type`: `VARCHAR(64)` NOT NULL (`cyclone`, `high_surf`, `storm_surge`)
  - `source`: `VARCHAR(128)` NOT NULL (`NOAA IBTrACS`, `GDACS`)
  - `basin`: `VARCHAR(64)` NULL (`arabian_sea`, `bay_of_bengal`, `south_indian_ocean`)
  - `status`: `VARCHAR(32)` NOT NULL (`historical`, `active`, `past`)
  - `first_observed`: `TIMESTAMP` NULL
  - `last_observed`: `TIMESTAMP` NULL
  - `metadata`: `JSON` NULL (Stores GDACS alert scores, report URLs, event IDs)
  - `created_at`: `TIMESTAMP` NOT NULL
- **Indexes:** None beyond PK.

### 2. `hazard_tracks`
- **Columns:**
  - `id`: `VARCHAR(64)` NOT NULL (PK)
  - `hazard_id`: `VARCHAR(64)` NOT NULL (FK $\rightarrow$ `hazards.id`)
  - `time`: `TIMESTAMP` NOT NULL
  - `latitude`: `DOUBLE PRECISION` NOT NULL
  - `longitude`: `DOUBLE PRECISION` NOT NULL
  - `wind_speed_knots`: `DOUBLE PRECISION` NULL
  - `pressure_hpa`: `DOUBLE PRECISION` NULL
  - `category`: `VARCHAR(32)` NULL
  - `is_forecast`: `BOOLEAN` NOT NULL
  - `metadata`: `JSON` NULL
- **Foreign Keys:**
  - `hazard_id` $\rightarrow$ `hazards.id` (ON DELETE CASCADE)
- **Indexes:**
  - `ix_hazard_tracks_hazard_time` on `(hazard_id, time)`

### 3. `marine_forecasts`
- **Columns:**
  - `id`: `VARCHAR(64)` NOT NULL (PK)
  - `provider`: `VARCHAR(64)` NOT NULL (`open-meteo-marine`)
  - `model`: `VARCHAR(64)` NOT NULL (`ecmwf_wam` / `gwam`)
  - `latitude`: `DOUBLE PRECISION` NOT NULL
  - `longitude`: `DOUBLE PRECISION` NOT NULL
  - `valid_time`: `TIMESTAMP` NOT NULL
  - `wave_height_m`: `DOUBLE PRECISION` NULL
  - `wave_period_s`: `DOUBLE PRECISION` NULL
  - `wave_direction_deg`: `DOUBLE PRECISION` NULL
  - `wind_wave_height_m`: `DOUBLE PRECISION` NULL
  - `swell_wave_height_m`: `DOUBLE PRECISION` NULL
  - `retrieval_time`: `TIMESTAMP` NOT NULL
  - `source_url`: `VARCHAR(255)` NOT NULL
  - `metadata`: `JSON` NULL
  - `created_at`: `TIMESTAMP` NOT NULL
  - `updated_at`: `TIMESTAMP` NOT NULL
- **Constraints & Indexes:**
  - `uq_marine_forecast_loc_time` UNIQUE on `(provider, latitude, longitude, valid_time)`
  - `ix_marine_forecast_loc_time` on `(latitude, longitude, valid_time)`
  - `ix_marine_forecast_valid_time` on `(valid_time)`

### 4. `cyclone_forecast_runs`
- **Columns:**
  - `id`: `VARCHAR(64)` NOT NULL (PK)
  - `storm_id`: `VARCHAR(64)` NOT NULL
  - `storm_name`: `VARCHAR(128)` NOT NULL
  - `basin`: `VARCHAR(64)` NOT NULL
  - `provider`: `VARCHAR(64)` NOT NULL (`NOAA NHC`)
  - `advisory_number`: `VARCHAR(32)` NOT NULL
  - `issue_time`: `TIMESTAMP` NOT NULL
  - `retrieval_time`: `TIMESTAMP` NOT NULL
  - `source_url`: `VARCHAR(255)` NOT NULL
  - `metadata`: `JSON` NULL
  - `created_at`: `TIMESTAMP` NOT NULL
- **Constraints & Indexes:**
  - `uq_cyclone_fcst_run` UNIQUE on `(provider, storm_id, advisory_number)`
  - `ix_cyclone_fcst_run_storm` on `(storm_id, issue_time)`

### 5. `cyclone_forecast_positions`
- **Columns:**
  - `id`: `VARCHAR(64)` NOT NULL (PK)
  - `forecast_run_id`: `VARCHAR(64)` NOT NULL (FK $\rightarrow$ `cyclone_forecast_runs.id`)
  - `lead_time_hours`: `INTEGER` NOT NULL
  - `valid_time`: `TIMESTAMP` NOT NULL
  - `latitude`: `DOUBLE PRECISION` NOT NULL
  - `longitude`: `DOUBLE PRECISION` NOT NULL
  - `max_wind_knots`: `DOUBLE PRECISION` NULL
  - `wind_gusts_knots`: `DOUBLE PRECISION` NULL
  - `min_pressure_hpa`: `DOUBLE PRECISION` NULL
  - `classification`: `VARCHAR(32)` NULL
  - `stage_description`: `VARCHAR(64)` NULL
  - `metadata`: `JSON` NULL
- **Foreign Keys:**
  - `forecast_run_id` $\rightarrow$ `cyclone_forecast_runs.id` (ON DELETE CASCADE)
- **Constraints & Indexes:**
  - `uq_cyclone_fcst_pos` UNIQUE on `(forecast_run_id, lead_time_hours)`
  - `ix_cyclone_fcst_pos_run_lead` on `(forecast_run_id, lead_time_hours)`
  - `ix_cyclone_fcst_pos_valid_time` on `(valid_time)`

---

## 3. Database Migration History

The schema in `orca_db` is governed by Alembic migrations located in `backend/alembic/versions/`:

1. `20261015_1119_d403fca9b418_initial_orca_canonical_schema.py`:
   - Creates the initial canonical schema, including `hazards`, `hazard_tracks`, `datasets`, `geographic_features`, `marine_observations`, `investigations`, `findings`, `evidence_records`, `finding_evidence_link`, `execution_events`, and `verifications`.
2. `20261015_1642_a1d8b97152ca_create_marine_and_cyclone_forecast_.py`:
   - Adds Person 2 forecasting tables: `marine_forecasts`, `cyclone_forecast_runs`, and `cyclone_forecast_positions`.

---

## 4. Export Command & Safety Validation

### Export Execution Details
- **Command Used (No secrets exposed):**
  ```bash
  pg_dump -h localhost -p 5432 -U orca -d orca_db -Fc \
    --no-owner --no-privileges \
    -t alembic_version \
    -t hazards \
    -t hazard_tracks \
    -t marine_forecasts \
    -t cyclone_forecast_runs \
    -t cyclone_forecast_positions \
    -f /home/ckirankumar/orca/handoff/person2/person2_database.dump
  ```
- **File Validation:**
  - Size: **889,237 bytes (~889 KB)**
  - File exists and is non-empty.
  - Verified with `pg_restore -l /home/ckirankumar/orca/handoff/person2/person2_database.dump`: All 33 TOC table and data entries are intact and readable.
- **Privacy & Safety:**
  - Explicitly queried and dumped from `orca_db`. The protected database `orca` was never accessed.
  - Excludes all credentials, user tables, session tokens, and passwords.

---

## 5. How My Teammate Should Restore the Data

To restore this Person 2 data into an integration database:

1. **Create an empty integration database** (e.g. `orca_integration` or a fresh `orca_db`):
   ```bash
   createdb -h localhost -p 5432 -U orca orca_integration
   ```
2. **Apply Alembic migrations first** to create all tables with proper types and indexes:
   ```bash
   cd backend
   alembic upgrade head
   ```
3. **Restore the data using `pg_restore`:**
   ```bash
   pg_restore -h localhost -p 5432 -U orca -d orca_integration \
     --data-only \
     --no-owner \
     --no-privileges \
     /path/to/person2_database.dump
   ```
   *(Alternatively, if restoring into a completely blank database without prior migrations, omit `--data-only` and `pg_restore` will create the tables and load data simultaneously).*
4. **Verify row counts:**
   ```bash
   psql -h localhost -p 5432 -U orca -d orca_integration -c "
     SELECT 'hazards' as tbl, count(*) FROM hazards
     UNION ALL SELECT 'hazard_tracks', count(*) FROM hazard_tracks
     UNION ALL SELECT 'marine_forecasts', count(*) FROM marine_forecasts
     UNION ALL SELECT 'cyclone_forecast_runs', count(*) FROM cyclone_forecast_runs
     UNION ALL SELECT 'cyclone_forecast_positions', count(*) FROM cyclone_forecast_positions;
   "
   ```
   Expected: `hazards`: 1,865; `hazard_tracks`: 62,874; `marine_forecasts`: 387; `cyclone_forecast_runs`: 4; `cyclone_forecast_positions`: 27.
