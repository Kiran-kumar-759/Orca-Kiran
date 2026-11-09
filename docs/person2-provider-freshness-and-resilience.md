# Person 2 — Provider Data Freshness, Persisted Fallback & Failure Resilience (Phase P2-05)

**Role:** Person 2 — Marine Hazard & Forecast Agent  
**Branch:** `feature/person2-marine-hazard`  
**Application Database:** PostgreSQL `orca_db` (Protected historical DB: `orca` untouched)  
**Date:** October 2026

---

## 1. Executive Summary & Purpose

Phase P2-05 hardens Person 2's data pipelines (GDACS Live Cyclone Alerts, Open-Meteo Marine Wave Forecasts, and NOAA NHC Cyclone Forecast Advisories) against provider outages, slow responses, rate limiting, and network failures.

The system ensures:
1. **Zero Data Loss on Provider Outage:** Persisted records in PostgreSQL `orca_db` remain completely accessible when external providers fail.
2. **Deterministic Freshness Classification:** Evaluates freshness using configurable, domain-tailored thresholds rather than arbitrary guesses.
3. **Truthful Status Reporting:** Distinguishes attempted sync, valid response retrieval, database persistence, and presentation. Failed syncs never masquerade as successful updates.
4. **Idempotent Concurrency Control:** Unified per-pipeline locks prevent concurrent racing sync operations from generating duplicates or inconsistent tracking states.
5. **Clear Geographic Limitations:** NOAA NHC's coverage is explicitly documented as Eastern Pacific, North Atlantic, and Central Pacific, clarifying that it does not cover the Indian Ocean.

---

## 2. Freshness Policy & Domain Rationale

Data freshness is evaluated deterministically using UTC-aware timestamps against explicit threshold configurations.

| Provider Pipeline | Config Parameter | Freshness Threshold | Update Cadence & Rationale |
| :--- | :--- | :--- | :--- |
| **UN/EU GDACS Live Alerts** | `GDACS_FRESHNESS_HOURS` | **6 Hours** | GDACS aggregates global tropical cyclone alert bulletins continuously, typically updating event coordinates every 3–6 hours. Alerts older than 6 hours are considered `stale`. |
| **Open-Meteo Marine Forecasts** | `OPEN_METEO_FRESHNESS_HOURS` | **12 Hours** | Numerical wave models (e.g. ECMWF WAM, GFS Wave) run on 6-hour or 12-hour operational cycles. Persisted gridded wave points older than 12 hours transition to `stale`. |
| **NOAA NHC Forecast Advisories** | `NOAA_NHC_FRESHNESS_HOURS` | **6 Hours** | The National Hurricane Center issues official advisory packages every 6 hours (0300, 0900, 1500, 2100 UTC). Advisories older than 6 hours are marked `stale`. |

### Freshness States

- `fresh`: Persisted data was retrieved/issued within the threshold window.
- `stale`: Persisted data exists and remains usable, but its age exceeds the threshold.
- `unavailable`: Zero verified records exist in PostgreSQL for the requested query.
- `unknown`: Timestamp metadata is missing or invalid. Timestamps are never fabricated.

---

## 3. Timestamp Semantics & Disambiguation

ORCA strictly distinguishes the following timestamp concepts:

1. **Attempt Time (`last_attempt_utc`):** When ORCA initiated a sync HTTP request. Recorded at request start in the reliability tracker.
2. **Retrieval Time (`retrieval_time`):** When a valid response was successfully received from the external upstream provider.
3. **Persistence Time (`created_at` / `updated_at`):** When the validated records were committed into PostgreSQL `orca_db`.
4. **Sync Time (`last_sync_utc`):** When the entire pipeline (fetch + validate + upsert + commit) completed successfully.
5. **Source Issuance Time (`issue_time`):** The upstream provider's official issuance timestamp (e.g., NHC advisory bulletin header `1500 UTC THU OCT 15 2026`). Not fabricated for providers that do not issue bulletins. Note that Open-Meteo's `generationtime_ms` is computation duration, not issuance time.
6. **Forecast Valid Time (`valid_time`):** The specific future hour that a predicted wave state or cyclone waypoint represents (e.g., `TAU 24h` position). Valid times are never altered to make old data appear current.
7. **Last Known Usable Data (`is_fallback`):** When an upstream sync attempt fails, previously stored database records are flagged as fallback data (`is_fallback = true`).

---

## 4. Provider Reliability & Failure Handling

### Bounded Retries & Backoff with Jitter

All HTTP provider clients (`GDACSClient`, `OpenMeteoMarineClient`, `NOAAForecastClient`) implement bounded retry mechanisms:

- **Timeout:** Finite timeout per request (`EXTERNAL_REQUEST_TIMEOUT_SECONDS = 20.0s`).
- **Retries:** Configurable bounded retries (`MAX_PROVIDER_RETRIES = 2`).
- **Backoff:** Exponential backoff (`RETRY_BASE_DELAY_SECONDS * (2**attempt) + random.uniform(0.05, 0.15)`), clamped to `MAX_RETRY_DELAY_SECONDS = 5.0s`.
- **HTTP 429 Rate Limiting:** Inspects the `Retry-After` response header, parses integer seconds, clamps to 5.0s, and sleeps before retrying.
- **HTTP 5xx Server Errors:** Retryable with exponential backoff.
- **HTTP 4xx Client Errors:** Non-retryable; fails immediately without wasted retry loops.
- **Malformed JSON:** Caught safely and reported as a validation failure rather than causing unhandled crashes.

### Concurrency Locking

In-memory locks managed by `reliability_tracker.get_lock(provider)` prevent race conditions from concurrent sync requests for the same provider pipeline.

---

## 5. Persisted Fallback Behavior

When an upstream provider refresh fails (timeout, 5xx, 429 exhaustion, network drop):
1. The sync API endpoint returns an honest `HTTP 502 Bad Gateway` describing the upstream failure.
2. The `last_successful_sync_utc` timestamp in PostgreSQL/tracker is **never** updated or cleared.
3. Previously persisted records remain fully intact in `orca_db`.
4. Subsequent `GET` queries to `/api/v1/forecasts/marine` or `/api/v1/forecasts/cyclones/runs` continue to return the stored records, flagged with `is_fallback: true` and their honest freshness state (`fresh` or `stale`).
5. Status endpoints (`/sync/gdacs/status`, `/forecasts/marine/status`, `/forecasts/cyclones/status`) report `is_fallback: true`, `is_healthy: false`, and a user-readable error explanation without leaking credentials or stack traces.

---

## 6. API Contracts

### Endpoints Implemented & Verified

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/hazards/sync/gdacs` | Sync active tropical cyclone alerts from GDACS |
| `GET` | `/api/v1/hazards/sync/gdacs/status` | Retrieve GDACS provider status, freshness, and fallback state |
| `POST` | `/api/v1/forecasts/marine/sync` | Ingest Open-Meteo marine wave forecasts |
| `GET` | `/api/v1/forecasts/marine/status` | Retrieve Open-Meteo provider health, freshness, and total points |
| `GET` | `/api/v1/forecasts/marine` | Query persisted hourly points (includes `freshness`, `is_fallback`, `last_retrieved_utc`) |
| `GET` | `/api/v1/forecasts/marine/latest` | Query nearest upcoming hourly forecast point |
| `POST` | `/api/v1/forecasts/cyclones/sync` | Ingest NOAA NHC active cyclone forecast advisory runs |
| `GET` | `/api/v1/forecasts/cyclones/status` | Retrieve NOAA NHC provider status, freshness, positions, and coverage |
| `GET` | `/api/v1/forecasts/cyclones/runs` | Query persisted runs (includes `freshness`, `is_fallback`, `geographic_coverage`) |
| `GET` | `/api/v1/forecasts/cyclones/runs/{run_id}/positions` | Query chronological predicted waypoints |

---

## 7. Frontend Reliability UI (`/hazard-demo`)

The `/hazard-demo` interface provides clear visual status across all pipelines:

1. **PipelineStatusPill:**
   - Displays provider name with an animated pulse indicator.
   - Status badge: `FRESH` (emerald), `STALE` (amber), `UNAVAILABLE` (rose), `UNKNOWN` (slate), `SYNCING` (cyan).
   - `FALLBACK` badge: Visible in amber whenever displayed data originates from prior persisted syncs after a failed refresh.
   - Popover drawer: Clicking the status pill reveals local display time, UTC time, last attempt status, freshness evaluation details, and geographic coverage notes.
2. **Duplicate-Submission Prevention:**
   - Sync buttons enter a disabled, spinning state (`disabled={isSyncing}`) while a sync is in progress.
3. **Fallback Banners:**
   - Displays clear contextual alert banners explaining when upstream refreshes fail and how many persisted fallback records are currently being served from `orca_db`.
4. **NOAA NHC Geographic Coverage Notice:**
   - Prominently informs users that NOAA NHC jurisdiction covers Eastern Pacific, North Atlantic, and Central Pacific, and that Indian Ocean cyclogenesis (IMD) is outside NHC jurisdiction.

---

## 8. Failure Scenario Reproduction in Tests

The automated test suite verifies failure modes with zero dependence on external network availability:

- **Deterministic Freshness:** `tests/unit/test_freshness.py`
  - Tests evaluate timestamps inside, at, and outside threshold hours.
  - Tests clock skew tolerance and missing timestamps (`UNKNOWN`).
  - Tests provider isolation in `ProviderReliabilityTracker`.
- **Provider Resilience:**
  - `tests/unit/test_gdacs_client.py`: Tests HTTP 429 with `Retry-After`, malformed JSON, and 4xx client errors.
  - `tests/unit/test_open_meteo_client.py`: Tests HTTP 429 backoff, malformed JSON, and client error handling.
  - `tests/unit/test_nhc_client.py`: Tests HTTP 429 backoff, malformed JSON, 404 handling, and coverage constant.
- **Persisted Fallback & Status APIs:** `tests/api/test_provider_status_api.py`
  - Verifies that after a simulated 502/timeout failure, database queries still succeed, previous records remain intact, `is_fallback` is set to `True`, and status endpoints report the failure honestly.

---

## 9. Manual Verification Steps in Browser

To verify manually:
1. Ensure FastAPI is running on `http://127.0.0.1:8000` and Vite on `http://localhost:5173`.
2. Open `http://localhost:5173/hazard-demo`.
3. Observe the header: GDACS status pill shows `FRESH` with active alert count. Click the pill to view UTC/local timestamps in the popover.
4. Navigate to the **Forecasts** tab:
   - In **Marine Wave Forecasts**: Notice the `Open-Meteo` status pill (`FRESH`). Click to view popover. Click **Sync Marine Forecast** to trigger a bounded sync.
   - Switch to **Cyclone 5-Day Trajectory**: Notice the `NOAA NHC` status pill (`FRESH`) and the Geographic Coverage Notice regarding Eastern Pacific/Atlantic jurisdiction.
5. To test fallback mode: Temporarily disconnect internet or block outgoing port; click sync; observe that previously persisted forecast points/runs remain displayed on charts and tables with a clear Fallback Banner.
