# ORCA — Person 2: Marine Hazard & Forecast Agent (P2-06)

## 1. Overview & Agent Scope

The **Marine Hazard & Forecast Agent** (`marine_hazard`) is an autonomous specialist agent within the ORCA platform. Its mission is to produce scientifically grounded, evidence-linked marine hazard assessments from verified PostgreSQL datasets.

The agent investigates:
1. **Marine Sea State & Wave Forecasts**: Hourly significant wave height, peak period, wave direction, and swell height from Open-Meteo Marine.
2. **Real-time Tropical Cyclone Advisories**: Active multi-hazard alerts from GDACS (Global Disaster Alert and Coordination System).
3. **Historical Cyclone Benchmarks**: Retrospective cyclone tracks and landfall proximity from NOAA IBTrACS v04r01.
4. **Authoritative Cyclone Forecast Runs**: Official 5-day cyclone trajectory runs and forecast positions from NOAA NHC (National Hurricane Center).
5. **Data Freshness & Provenance Governance**: SLA freshness monitoring, provider fallback tracking, and geographic boundary enforcement.

---

## 2. Shared Agent Architecture & Contracts

The agent adheres strictly to the ORCA shared agent contract without introducing competing base classes or parallel registries:

- **Base Class**: Inherits from `app.agents.base.SpecialistAgent`.
- **Input Contract**: `InvestigationTask(investigation_id, workspace, query, location, time_window, parameters)`.
- **Output Contract**: `AgentResult(agent_id, status, findings, evidence, limitations, errors)`.
- **Status Lifecycle**: `AgentExecutionStatus` (`completed`, `partial`, `unavailable`, `failed`).

### Intent Classification
The agent deterministically classifies user inquiries into supported analysis intents:
- `marine_forecast`: Gridded wave heights, swell components, and Douglas sea-state evaluation.
- `current_hazards`: Active GDACS disaster alerts and distance to centroid fixes.
- `historical_cyclone_analysis`: Proximity search against NOAA IBTrACS best-track archive.
- `cyclone_forecast_lookup`: Authoritative NOAA NHC 5-day forecast runs with waypoint trajectories.
- `data_freshness`: Provider sync state, freshness evaluation (fresh, stale, unavailable), and fallback flags.
- `comprehensive_hazard_assessment`: Multi-pipeline scientific synthesis.

---

## 3. Scientific Methodologies & Deterministic Algorithms

The agent does **not** allow an LLM to invent numeric values, fabricate coordinates, or hallucinate scientific thresholds. All quantitative conclusions are computed deterministically:

### 3.1 WMO No. 8 Douglas Sea Scale
Derived from significant wave height ($H_s$ in meters):
- $0.0 \le H_s < 0.5\text{ m}$: Calm (Glassy to Rippled)
- $0.5 \le H_s < 1.25\text{ m}$: Smooth to Slight (safe for artisanal craft)
- $1.25 \le H_s < 2.5\text{ m}$: Moderate (caution advised for small vessels)
- $2.5 \le H_s < 4.0\text{ m}$: Rough (hazardous; small craft advisories)
- $4.0 \le H_s < 6.0\text{ m}$: Very Rough (dangerous breaking seas)
- $6.0 \le H_s < 9.0\text{ m}$: High (severe navigation hazard)
- $H_s \ge 9.0\text{ m}$: Phenomenal (mountainous seas)

### 3.2 Cyclone Wind Band Intensity (IMD / WMO)
Derived from 1-minute or 3-minute sustained wind speed ($V$ in knots):
- $V < 28\text{ kts}$: Low Pressure Area / Depression
- $28 \le V < 34\text{ kts}$: Deep Depression
- $34 \le V < 48\text{ kts}$: Cyclonic Storm (Tropical Storm equivalent)
- $48 \le V < 64\text{ kts}$: Severe Cyclonic Storm
- $64 \le V < 90\text{ kts}$: Very Severe Cyclonic Storm (Cat 1-2 equivalent)
- $90 \le V < 120\text{ kts}$: Extremely Severe Cyclonic Storm (Cat 3-4 equivalent)
- $V \ge 120\text{ kts}$: Super Cyclonic Storm (Cat 5 equivalent)

### 3.3 Strict Geographic Boundary Enforcement (NOAA NHC)
NOAA National Hurricane Center has an authoritative mandate restricted to:
- North Atlantic Basin
- Eastern North Pacific Basin
- Central North Pacific Basin

**Indian Ocean Rule**: When target coordinates lie in the North Indian Ocean ($30^\circ\text{E} \le \text{Lon} \le 110^\circ\text{E}$, $-40^\circ\text{S} \le \text{Lat} \le 32^\circ\text{N}$, or basins Arabian Sea / Bay of Bengal), the agent emits an explicit `OUT_OF_COVERAGE` finding:
> *"NOAA NHC Pipeline Boundary Notice: Target location lies in the Indian Ocean basin, which is outside the authoritative forecast coverage of the National Hurricane Center. No NHC cyclone advisories are geographically applicable."*

---

## 4. Evidence Traceability & Provenance Contract

Every `Finding` contains an explicit array of `evidence_ids`. Every evidence ID resolves to an `EvidenceRecord` persisted or retrieved from PostgreSQL with full provenance:
- `id`: Deterministic evidence ID (`ev-marine-wave-...`, `ev-gdacs-...`, `ev-ibtracs-...`, `ev-nhc-...`)
- `dataset_id`: `open-meteo-marine`, `gdacs-tc`, `noaa-ibtracs`, `noaa-nhc`, `orca-data-governance`
- `source_name`: Authoritative provider name
- `source_url`: Official upstream reference URL
- `retrieval_time`: Exact UTC sync timestamp
- `observation_time`: Model valid time or observational fix time
- `quality_flag`: `verified_forecast_timeseries`, `verified_live_advisory`, `verified_best_track`, `verified_coverage_audit`
- `license`: CC-BY 4.0, Public Domain, UN-EU

---

## 5. API Reference & Endpoint Contract

### Endpoint
`POST /api/v1/hazards/agent/analyze`

### Request Schema (`HazardAgentAnalysisRequest`)
```json
{
  "query": "Assess wave conditions, Douglas sea state, and storm hazard risk for Mangaluru",
  "location": "Mangaluru",
  "latitude": 12.91,
  "longitude": 74.85,
  "radius_km": 50.0,
  "intent": "comprehensive_hazard_assessment"
}
```

### Response Schema (`HazardAgentAnalysisResponse`)
```json
{
  "investigation_id": "inv-hz-fcf6ca02",
  "agent_id": "marine_hazard",
  "status": "completed",
  "executive_summary": "**Marine Hazard Assessment for Mangaluru**\n- **Sea State & Waves**: Moderate sea state predicted over next 72h (Peak wave height 1.50m, period 10.1s, swell 0.5m).\n- **Active Cyclone Alerts**: No active tropical cyclone alerts currently monitored in PostgreSQL.\n\n*Advisory Disclaimer*: ORCA Marine Hazard assessments are generated from gridded numerical models for decision support...",
  "target_location": {
    "latitude": 12.91,
    "longitude": 74.85,
    "name": "Mangaluru",
    "radius_km": 50.0
  },
  "findings": [
    {
      "id": "f-marine-wave-mf-om-12.875-74.792-202610150000",
      "claim": "Marine Sea State Forecast (Status: FORECAST): Moderate sea state predicted for Mangaluru over next 72h. Peak wave height reaches 1.50m...",
      "value": 1.50,
      "unit": "meters",
      "evidence_ids": ["ev-marine-wave-mf-om-12.875-74.792-202610150000"],
      "uncertainty": "Global wave model resolution ~9 km; nearshore bathymetric amplification not accounted for",
      "is_forecast": true,
      "observation_time": "2026-10-15T05:30:00+05:30"
    }
  ],
  "evidence": [
    {
      "id": "ev-marine-wave-mf-om-12.875-74.792-202610150000",
      "dataset_id": "open-meteo-marine",
      "source_name": "Open-Meteo Marine Forecast API",
      "source_url": "https://marine-api.open-meteo.com/v1/marine",
      "retrieval_time": "2026-10-15T23:55:41.358630+05:30",
      "observation_time": "2026-10-15T05:30:00+05:30",
      "variable": "significant_wave_height",
      "value": {
        "max_wave_m": 1.5,
        "mean_wave_m": 0.65,
        "latest_wave_m": 0.64,
        "wave_period_s": 10.1,
        "wave_direction_deg": 206.0,
        "swell_wave_height_m": 0.48,
        "points_analyzed": 72
      },
      "unit": "meters",
      "quality_flag": "verified_forecast_timeseries",
      "license": "CC-BY 4.0"
    }
  ],
  "limitations": [
    "Official localized storm warning signals (1-11) must be verified directly with national authorities (IMD/JTWC).",
    "Historical cyclone tracks represent retrospective benchmarks, not operational forecasts of future events."
  ],
  "errors": [],
  "generated_at_utc": "2026-10-17T05:04:28.804537Z"
}
```

---

## 6. Frontend Integration (`/hazard-demo`)

The agent is directly usable via the existing Person 2 demo route at `/hazard-demo`:
- **Navigation Tab**: A prominent "Marine Hazard Agent (P2-06)" tab is added alongside Live Alerts, Marine & Cyclone Forecasts, and Historical Tracks.
- **Scenario Presets**: Instant one-click triggers for Wave & Sea State, Active Alerts, Historical Benchmark, NOAA NHC Boundary Audit, and Pipeline Freshness.
- **Geographic Anchor Selector**: Quick presets for major Indian coastal hubs (Mangaluru, Mumbai, Kochi, Goa, Chennai, Visakhapatnam, Kolkata) and Atlantic test hub (Miami), with custom latitude/longitude coordinate overrides.
- **Executive Synthesis Card**: High-visibility summary card detailing the sea state, alerts, forecasts, and precedent.
- **Findings List**: Individual claim cards displaying status flags (`ACTIVE`, `FORECAST`, `HISTORICAL`, `OUT_OF_COVERAGE`), values, units, and uncertainty intervals.
- **Traceable Evidence Accordion**: Interactive cards showing exact database payloads, observation timestamps, retrieval timestamps, quality flags, and upstream links.
- **Scientific Limitations Box**: Operational caveats and official governance disclaimers.

---

## 7. Verification & Test Suite Summary

- **Backend Pytest Suite**: 93 out of 93 tests passing (`pytest backend/tests/ -v`).
  - Unit tests: Sea-state Douglas scale thresholds, IMD cyclone wind intensity classification, intent detection, evidence ID traceability, NHC boundary rejection.
  - API integration tests: `POST /api/v1/hazards/agent/analyze` endpoint success, geocoding fallback, coordinate validation (422 for out-of-range), and NHC boundary warnings.
- **Linter & Formatter**: `ruff check` and `ruff format --check` pass with 0 errors across `app` and `tests`.
- **Frontend Production Build**: `npm run build` succeeds with zero TypeScript or bundling errors.
- **Database Safety**: All tests and queries strictly targeted PostgreSQL `orca_db`. The historical database `orca` was never accessed or modified.
