# ORCA Person 2 Integration Handoff Document: Marine Hazard & Forecast Agent

**Author:** Person 2 — Marine Hazard & Forecast Specialist  
**Repository:** `/home/ckirankumar/orca`  
**Current Branch:** `feature/person2-marine-hazard`  
**Verified Commit Hash:** `35ced597f1aef2a15a4dc9ac20c584ffc69c6722`  
**Target Database:** `orca_db` (PostgreSQL 18.6)  
**Date of Handoff:** 2026-10-17  

---

## Table of Contents
1. [Section A: Project Overview](#section-a-project-overview)
2. [Section B: Current Implementation Status](#section-b-current-implementation-status)
3. [Section C: Architecture & File Map](#section-c-architecture--file-map)
4. [Section D: API Integration Contract](#section-d-api-integration-contract)
5. [Section E: Agent Capabilities & Tools](#section-e-agent-capabilities--tools)
6. [Section F: Marine Data Sources & Provenance](#section-f-marine-data-sources--provenance)
7. [Section G: Database Schema & Data Inventory](#section-g-database-schema--data-inventory)
8. [Section H: Frontend Integration Guide](#section-h-frontend-integration-guide)
9. [Section I: Integration Checklist](#section-i-integration-checklist)
10. [Section J: Handover Notes & Unresolved Decisions](#section-j-handover-notes--unresolved-decisions)

---

## Section A: Project Overview

### 1. What ORCA Is
**ORCA (Ocean Risk & Coastal Analytics)** is an AI-powered maritime and coastal intelligence platform designed to protect coastal livelihoods, fisheries, port operations, and disaster management teams across the Indian Ocean basin (specifically the Arabian Sea and Bay of Bengal).

### 2. Person 2 Responsibility
Person 2 is responsible for the **Marine Hazard & Forecast Agent** subsystem, encompassing:
- **Historical Cyclone Intelligence:** Ingestion, parsing, database persistence, and spatial proximity search of historical tropical cyclone tracks from NOAA IBTrACS (1980–present).
- **Active Hazard Ingestion:** Automated synchronization, geographic filtering, and threat assessment of live tropical cyclone alerts from GDACS (Global Disaster Alert and Coordination System).
- **Operational Marine Wave Forecasting:** Numerical ocean wave modeling integration via Open-Meteo Marine (hourly forecasts of wave height, period, direction, swell, and wind waves) with WMO Douglas Sea State classification.
- **Operational Cyclone Track Forecasting:** NHC (National Hurricane Center) advisory and waypoint ingestion with boundary enforcement.
- **Conversational Multi-Turn AI Agent:** An autonomous tool-calling specialist agent that routes queries to real Python tools, executes PostgreSQL and external API retrievals, feeds results back to an LLM (Groq $\rightarrow$ Gemini $\rightarrow$ OpenRouter $\rightarrow$ Deterministic Fallback), and produces scientifically grounded advisories with evidence citations (`Finding` and `EvidenceRecord`).
- **Disaster Management / Hazard Demo Interface:** Full-featured UI featuring interactive Leaflet cyclone tracking maps, timeline animations, forecast tables, and a conversational specialist chat interface.

### 3. Role in the Overall System
In ORCA's multi-agent architecture:
- **Person 1 (Marine Monitoring Agent):** Handles in-situ water quality, chlorophyll, sea surface temperature (SST), and buoy sensor monitoring.
- **Person 2 (Marine Hazard & Forecast Agent - THIS COMPONENT):** Serves as the authoritative source for high-energy oceanic events (cyclones, gale waves, storm surge risks, coastal hazard warnings, and Douglas Sea State safety).
- **Person 3 (Coastal Authority Agent):** Handles coastal regulation zones (CRZ), infrastructure vulnerability, and mangrove protection.
- **Person 4 (Evidence & Scientific Verification Agent):** Independently audits and verifies claims made by specialist agents against registered datasets and evidence records.
- **Orchestrator:** Coordinates complex multi-specialist investigations, decomposing broad user prompts into tasks dispatched to Person 1, Person 2, and Person 3.

### 4. Agents vs. Workspaces vs. Platform Infrastructure
- **Specialist Agent:** A backend Python service inheriting from `SpecialistAgent` (`backend/app/agents/marine_hazard/agent.py`) capable of one-shot investigation execution (`run(InvestigationTask)`) and conversational chat with tool-calling (`chat()`).
- **Frontend Workspace:** Role-specific user interfaces (e.g. `FishermanWorkspace`, `DisasterManagementWorkspace`, `HazardDemoWorkspace`). The agent is **not** a workspace; workspaces are consumers of agent and hazard API endpoints.
- **Shared Platform Infrastructure:** Common database models (`Investigation`, `Finding`, `EvidenceRecord`), Alembic migration infrastructure, authentication/CORS settings, and shared LLM provider abstractions (`backend/app/providers/llm/`).

---

## Section B: Current Implementation Status

### 1. Completed & Verified Capabilities
- [x] **NOAA IBTrACS Pipeline:** Ingestion script (`scripts/import_hazard_data.py`), CSV parser (`app/providers/data/ibtracs.py`), and PostgreSQL storage of 1,864 North Indian Ocean historical storms and 62,800+ best-track points.
- [x] **GDACS Live Alerts Pipeline:** Client (`app/providers/data/gdacs.py`), geo-filtering, idempotent sync endpoint (`POST /api/v1/hazards/sync/gdacs`), and SLA freshness tracking.
- [x] **Open-Meteo Numerical Marine Forecast:** Client (`app/providers/data/open_meteo.py`), hourly database persistence (`marine_forecasts`), SLA tracking, and REST endpoints (`GET /api/v1/forecasts/marine`).
- [x] **NOAA NHC Forecast Pipeline:** Client (`app/providers/data/nhc.py`), waypoint storage (`cyclone_forecast_positions`), and strict geographic boundary enforcement for Indian Ocean coordinates (`OUT_OF_COVERAGE`).
- [x] **Deterministic Decision & Planning Engine:** Query intent classification (`detect_analysis_intent`), geographic place name extraction (`extract_explicit_place_name`), location transition handling (Mangaluru $\rightarrow$ Chennai), and data source planning (`classify_and_plan_data_sources`).
- [x] **LLM Tool-Calling Loop:** Full autonomous tool selection, execution, and synthesis loop via Groq (`openai/gpt-oss-120b` / `qwen/qwen3.8-27b`), secondary fallback to Gemini (`gemini-flash-latest`), tertiary fallback to OpenRouter, and controlled final fallback to the deterministic rule engine.
- [x] **Scientific Calculations:** WMO No. 8 Douglas Sea Scale classification, IMD/Saffir-Simpson wind scale mapping, and Haversine closest-approach cyclone distance calculations.
- [x] **Truthful Telemetry:** UI badges and API response metadata truthfully distinguish between `groq`, `gemini`, `openrouter`, and `deterministic_fallback`, reporting model names and executed tool names.
- [x] **Chat Controls:** Geographic anchor selection, custom coordinate overrides, force live refresh, and session reset with evidence pool isolation.
- [x] **Frontend Demo Workspace:** Interactive Leaflet map (`CycloneMap.tsx`), timeline playback (`CycloneTrackTimeline.tsx`), filter controls, and conversational chat panel (`MarineHazardAgentPanel.tsx`).

### 2. Tested Functionality
- **Automated Backend Tests:** **120 unit and integration tests passing** (`pytest backend/tests/ -v`).
  - Dedicated tool-calling suite: `backend/tests/unit/test_groq_tool_calling.py` (9 tests passed).
  - Hazard API suite: `backend/tests/api/test_hazards_api.py` (13 tests passed).
  - Forecast API suite: `backend/tests/api/test_forecasts_api.py` (8 tests passed).
  - Provider status & resilience suite: `backend/tests/api/test_provider_status_api.py` (6 tests passed).
  - Workspace chat integration: `backend/tests/api/test_workspace_chat_integration.py` (3 tests passed).
  - Data selection & location transition: `backend/tests/unit/test_marine_data_selection.py` (10 tests passed).
  - Agent core & scientific unit tests: `backend/tests/unit/test_marine_hazard_agent.py` (11 tests passed).
- **Frontend Build:** Verified via `npm run build` (`tsc -b && vite build`) in 6.21s with **0 TypeScript errors**.
- **Live Smoke Test:** Verified end-to-end against live Uvicorn server (`http://127.0.0.1:8000/api/v1/hazards/agent/chat`):
  - Turn 1 (Mangaluru): Status 200, Groq `openai/gpt-oss-120b`, real Open-Meteo tool executed.
  - Turn 2 (Chennai): Status 200, target location switched to Chennai, Chennai wave forecast retrieved.
  - Turn 3 (Tomorrow): Status 200, preserved Chennai anchor, isolated +24h to +48h forecast window.

### 3. Known Limitations & Dependencies
- **Groq Free-Tier Rate Limits:** Groq free-tier enforces a 30 RPM rate limit. When exceeded, the agent automatically fails over to Gemini, OpenRouter, or deterministic fallback.
- **NOAA NHC Coverage:** NHC is an Atlantic/Eastern Pacific operational center. It does not issue operational forecast advisories for the North Indian Ocean (which is under IMD/JTWC purview). NHC calls for Indian Ocean coordinates return `OUT_OF_COVERAGE`.
- **Database Safety:** Only `orca_db` may be connected to. The protected database `orca` must **never** be accessed.

---

## Section C: Architecture & File Map

### Directory Structure & Ownership
```text
orca/
├── backend/
│   ├── alembic/
│   │   └── versions/
│   │       ├── 20261015_1119_d403fca9b418_initial_orca_canonical_schema.py [Shared]
│   │       └── 20261015_1642_a1d8b97152ca_create_marine_and_cyclone_forecast_.py [Person 2]
│   ├── app/
│   │   ├── agents/
│   │   │   └── marine_hazard/           [Person 2 Owned]
│   │   │       ├── agent.py             <- Core MarineHazardAgent (chat, run, tools, LLM loop)
│   │   │       └── session.py           <- Multi-turn conversation session manager & isolation
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── hazards.py           <- Person 2 hazard & chat endpoints
│   │   │   │   ├── forecasts.py         <- Person 2 marine & cyclone forecast endpoints
│   │   │   │   └── health.py            <- Health & provider status
│   │   │   └── router.py                <- API router aggregating Person 1, 2, 3 routes
│   │   ├── core/
│   │   │   ├── config.py                <- Settings, DB URL, LLM models & timeouts
│   │   │   └── freshness.py             <- SLA tracking (GDACS 6h, Open-Meteo 12h, NHC 6h)
│   │   ├── db/
│   │   │   ├── repositories/
│   │   │   │   ├── hazard_repo.py       <- Person 2 hazard & track queries
│   │   │   │   └── forecast_repo.py     <- Person 2 marine & cyclone forecast queries
│   │   │   └── session.py               <- Engine & session factory (orca_db)
│   │   ├── models/
│   │   │   ├── hazard.py                <- Hazard & HazardTrack models
│   │   │   └── forecast.py              <- MarineForecast, CycloneForecast models
│   │   ├── providers/
│   │   │   ├── data/
│   │   │   │   ├── gdacs.py             <- GDACS live TC client
│   │   │   │   ├── ibtracs.py           <- NOAA IBTrACS historical parser
│   │   │   │   ├── open_meteo.py        <- Open-Meteo marine forecast client
│   │   │   │   └── nhc.py               <- NOAA NHC advisory client
│   │   │   └── llm/                     [Shared Infrastructure]
│   │   │       ├── base.py              <- LLMProvider, LLMResponse, LLMToolCall
│   │   │       ├── groq.py              <- Groq provider with tool calling
│   │   │       ├── gemini.py            <- Gemini provider with tool calling
│   │   │       └── openrouter.py        <- OpenRouter provider
│   │   └── schemas/
│   │       ├── hazard.py                <- HazardRead, HazardAgentChatRequest/Response
│   │       └── forecast.py              <- MarineForecastResponse, CycloneForecastRunItem
│   └── tests/
│       ├── api/                         <- Endpoint test suites
│       ├── integration/                 <- DB persistence integration tests
│       └── unit/                        <- Unit test suites (tools, math, selection)
├── frontend/
│   └── src/
│       ├── features/
│       │   └── hazard-demo/             [Person 2 Owned UI]
│       │       ├── api.ts               <- Axios client for Person 2 endpoints
│       │       ├── types.ts             <- TypeScript interfaces matching backend schemas
│       │       ├── HazardDemoWorkspace.tsx <- Main workspace tab container
│       │       └── components/
│       │           ├── MarineHazardAgentPanel.tsx <- Specialist AI agent chat UI
│       │           ├── CycloneMap.tsx             <- Leaflet map with cyclone tracks
│       │           ├── CycloneTrackTimeline.tsx   <- Time slider animation player
│       │           ├── CycloneFilters.tsx         <- Basin, severity, search filters
│       │           ├── MarineForecastPanel.tsx    <- Wave forecast table & charts
│       │           └── CycloneForecastPanel.tsx   <- NHC advisory viewer
│       └── types/
│           └── index.ts                 <- Shared frontend types
└── handoff/
    └── person2/                         <- Integration handoff package artifacts
```

### Execution Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as HazardDemoWorkspace / ChatPanel
    participant API as FastAPI Router (/api/v1/hazards/agent/chat)
    participant Agent as MarineHazardAgent
    participant Planner as Decision Planner (P2-06)
    participant LLM as Groq LLM (openai/gpt-oss-120b)
    participant Tools as Specialist Python Tools
    participant DB as PostgreSQL (orca_db)
    participant Ext as External APIs (Open-Meteo / GDACS)

    User->>UI: Submit natural language question
    UI->>API: POST /api/v1/hazards/agent/chat (payload)
    API->>Agent: chat(message, location, coordinates, session_id)
    Agent->>Planner: classify_and_plan_data_sources(query, loc)
    Planner-->>Agent: DecisionResult(intent, required_sources, cache_policy)
    
    rect rgb(240, 248, 255)
    Note over Agent,LLM: Step A & B: Interpret & Let Model Select Tools
    Agent->>LLM: chat_with_tools(messages + system_rules, HAZARD_AGENT_TOOLS)
    LLM-->>Agent: LLMToolCall: get_marine_forecast(lat, lon, loc)
    end

    rect rgb(245, 255, 245)
    Note over Agent,Tools: Step C: Validate & Execute Real Tools
    Agent->>Tools: tool_get_marine_forecast()
    Tools->>DB: Check cached marine_forecasts
    alt Stale or Empty
        Tools->>Ext: Fetch Open-Meteo marine API
        Ext-->>Tools: Numerical wave data
        Tools->>DB: Persist hourly forecasts
    end
    Tools-->>Agent: tool_result (wave_height=1.5m, Douglas=Moderate, evidence_id=...)
    end

    rect rgb(255, 245, 240)
    Note over Agent,LLM: Step D: Return Tool Results to Model
    Agent->>LLM: chat_with_tools(messages + tool_call_result)
    LLM-->>Agent: LLMResponse(content="Natural language advisory...", tool_calls=[])
    end

    rect rgb(245, 245, 255)
    Note over Agent,UI: Step E: Evidence Grounding & Truthful Telemetry
    Agent->>API: HazardAgentChatResponse(provider_used="groq", model_used="...", is_fallback=false, findings=[...], evidence=[...])
    API->>UI: JSON response
    UI-->>User: Rendered advisory with badge: [GROQ — LLM Tool-Calling Active]
    end
```

---

## Section D: API Integration Contract

All Person 2 endpoints are prefixed with `/api/v1`. Authentication is not required for these read/sync endpoints during the hackathon integration.

### Summary Table of Endpoints

| Method | Endpoint | Primary Purpose | Consumer Component |
|--------|----------|-----------------|--------------------|
| `POST` | `/api/v1/hazards/agent/chat` | Conversational multi-turn tool-calling agent chat | Workspace Chatbot, ChatPanel |
| `POST` | `/api/v1/hazards/agent/analyze` | One-shot structured investigation execution | Orchestrator, Batch Analysis |
| `GET` | `/api/v1/hazards` | Paginated search of historical & active hazards | CycloneFilters, CycloneMap |
| `GET` | `/api/v1/hazards/{hazard_id}` | Retrieve specific hazard event metadata | CycloneDetailPanel |
| `GET` | `/api/v1/hazards/{hazard_id}/track` | Retrieve full chronological coordinate track | CycloneMap, Timeline Player |
| `GET` | `/api/v1/hazards/{hazard_id}/stats` | Retrieve peak wind, min pressure, approach km | Detail Statistics Cards |
| `POST` | `/api/v1/hazards/sync/gdacs` | On-demand live GDACS tropical cyclone sync | Sync Button, Cron Job |
| `GET` | `/api/v1/hazards/sync/gdacs/status` | GDACS provider health & freshness status | PipelineStatusPill |
| `GET` | `/api/v1/forecasts/marine` | Hourly numerical ocean wave/wind forecasts | MarineForecastPanel, Fishermen UI |
| `GET` | `/api/v1/forecasts/marine/latest` | Immediate upcoming wave forecast point | Status Bar, Quick Summary |
| `POST` | `/api/v1/forecasts/marine/sync` | On-demand Open-Meteo gridded forecast sync | Refresh Button |
| `GET` | `/api/v1/forecasts/marine/status` | Open-Meteo SLA freshness & fallback state | PipelineStatusPill |
| `GET` | `/api/v1/forecasts/cyclones/runs` | List active NOAA NHC cyclone forecast runs | CycloneForecastPanel |
| `GET` | `/api/v1/forecasts/cyclones/runs/{run_id}/positions` | Waypoints for predicted cyclone track | CycloneMap (Forecast Cone) |
| `POST` | `/api/v1/forecasts/cyclones/sync` | Ingest active forecast runs from NOAA NHC | Sync Button |
| `GET` | `/api/v1/forecasts/cyclones/status` | NOAA NHC SLA health & boundary status | PipelineStatusPill |

### Detailed Specifications for Primary Integration Endpoints

#### 1. Conversational Chat: `POST /api/v1/hazards/agent/chat`
- **Request Body:** `HazardAgentChatRequest`
  ```json
  {
    "message": "What are the wave conditions off Mangaluru?",
    "conversation_id": null,
    "location": "Mangaluru",
    "latitude": 12.91,
    "longitude": 74.85,
    "radius_km": 50.0,
    "force_live_refresh": false,
    "use_custom_coordinates": false
  }
  ```
- **Response Schema:** `HazardAgentChatResponse`
  ```json
  {
    "conversation_id": "conv-hz-e033bad8",
    "message": "### Marine Wave Outlook for Mangaluru\n\n- **Significant Wave Height**: 1.50 m (Peak)\n- **Sea State**: Moderate (Douglas Degree 4)\n- **Caution**: Small artisanal fishing craft should exercise caution...",
    "provider_used": "groq",
    "model_used": "openai/gpt-oss-120b",
    "is_fallback": false,
    "provider_attempted": "groq",
    "fallback_reason": null,
    "synthesis_source": "llm",
    "trace_id": "tr-e033bad8",
    "target_location": {
      "latitude": 12.91,
      "longitude": 74.85,
      "name": "Mangaluru"
    },
    "decision": {
      "intent": "current_conditions",
      "requested_location": "Mangaluru",
      "resolved_location": "Mangaluru",
      "coordinates": [12.91, 74.85],
      "time_range": "current_conditions",
      "required_sources": ["open-meteo-marine", "gdacs-tc"],
      "cache_policy": "allow_fresh_cache (Open-Meteo SLA 12h, GDACS SLA 6h; refresh if stale)",
      "refresh_required": false,
      "reasoning_summary": "Query classified as 'current_conditions' for Mangaluru."
    },
    "tool_executions": [
      {
        "tool": "get_marine_forecast",
        "arguments": { "latitude": 12.91, "longitude": 74.85, "location_name": "Mangaluru", "hours": 72 },
        "status": "success",
        "summary": "success",
        "findings_count": 1,
        "evidence_count": 1
      }
    ],
    "findings": [
      {
        "id": "f-marine-wave-01",
        "claim": "Open-Meteo forecast indicates peak wave height of 1.50 m (Douglas Sea State: Moderate) off Mangaluru.",
        "value": 1.50,
        "unit": "m",
        "evidence_ids": ["ev-marine-wave-01"],
        "is_forecast": true
      }
    ],
    "evidence": [
      {
        "id": "ev-marine-wave-01",
        "dataset_id": "open-meteo-marine",
        "source_name": "Open-Meteo Marine Forecast",
        "source_url": "https://marine-api.open-meteo.com/v1/marine",
        "retrieval_time": "2026-10-17T11:00:00Z",
        "latitude": 12.91,
        "longitude": 74.85,
        "variable": "wave_height",
        "value": { "wave_height_m": 1.50 },
        "unit": "m",
        "quality_flag": "model_forecast"
      }
    ],
    "limitations": [
      "Official localized storm warning signals (1-11) must be verified directly with national authorities (IMD/JTWC)."
    ],
    "created_at_utc": "2026-10-17T11:00:05Z"
  }
  ```

#### 2. Paginated Hazard Search: `GET /api/v1/hazards`
- **Query Parameters:**
  - `basin`: `all` | `arabian_sea` | `bay_of_bengal`
  - `category`: `all` | `depression` | `deep_depression` | `cyclonic_storm` | `severe_cyclonic_storm` | `very_severe_cyclonic_storm` | `extremely_severe_cyclonic_storm` | `super_cyclone`
  - `search`: String (e.g. `Tauktae`, `Vardah`)
  - `page`: Integer (default 1)
  - `limit`: Integer (default 20, max 100)
  - `sort_by`: `last_observed` | `name` | `first_observed`
  - `sort_order`: `desc` | `asc`
- **Response Schema:** `HazardListResponse` (`count`, `total`, `page`, `limit`, `pages`, `items: list[HazardRead]`).

#### 3. Marine Forecast Lookup: `GET /api/v1/forecasts/marine`
- **Query Parameters:**
  - `latitude`: Float (e.g. `12.91`)
  - `longitude`: Float (e.g. `74.85`)
  - `hours`: Integer (default 72, max 168)
- **Response Schema:** `MarineForecastResponse` containing `items` with hourly timestamped predictions for wave height, wave period, swell wave height, and wind waves.

---

## Section E: Agent Capabilities & Tools

### 1. Registered Specialist Tools

The agent registers 9 typed tools in `HAZARD_AGENT_TOOLS`:

| Tool Name | Input Arguments | Data Source / Method | Output Description |
|-----------|-----------------|----------------------|--------------------|
| `get_marine_forecast` | `latitude`, `longitude`, `location_name`, `hours`, `is_tomorrow` | Open-Meteo / `marine_forecasts` table | Hourly wave metrics, peak $H_s$, mean $H_s$, Douglas Sea State classification, `Finding`, and `EvidenceRecord`. |
| `get_active_hazard_alerts` | `latitude`, `longitude`, `radius_km` | GDACS client / `hazards` table | Live cyclone alerts within radius; marks regional waters clear if no storms threaten the sector. |
| `search_historical_cyclones` | `latitude`, `longitude`, `radius_km`, `min_category` | NOAA IBTrACS / `hazard_tracks` table | Nearest historical cyclone approach, closest distance in km, peak wind speed, and landfall year. |
| `analyze_historical_cyclone_trends` | `basin`, `start_year`, `end_year` | NOAA IBTrACS / `hazards` table | Multi-decadal cyclone frequency trends, peak storm months (May–June, Oct–Nov), and intensity distributions. |
| `compare_current_vs_historical` | `latitude`, `longitude`, `location_name` | Open-Meteo & IBTrACS | Direct comparison between today's forecast wave height and historic cyclone approaches for the same sector. |
| `get_cyclone_forecast` | `latitude`, `longitude`, `location_name` | NOAA NHC / `cyclone_forecast_runs` | Active forecast tracks. Enforces geographic boundaries; safely flags Indian Ocean as `out_of_coverage`. |
| `check_data_freshness` | None / Coordinates | Internal Reliability Tracker | SLA freshness audit for GDACS, Open-Meteo, and NOAA NHC. |
| `calculate_sea_state` | `significant_wave_height_m` | Deterministic WMO math | Douglas Sea Scale (Degrees 0 to 9), operational safety description, and artisanal craft caution notes. |
| `classify_cyclone_intensity` | `wind_speed_knots` | Deterministic IMD math | IMD Cyclone Classification (Depression, CS, SCS, VSCS, ESCS, Super Cyclone) and Saffir-Simpson category. |

### 2. Multi-Provider Fallback Chain
The agent evaluates LLM providers in a strict priority sequence:
1. **Groq (Primary):** Active model `openai/gpt-oss-120b` (fallback model `qwen/qwen3.8-27b`). Provides sub-second tool-calling.
2. **Gemini (Secondary):** Active model `gemini-flash-latest`. Used if Groq credentials fail or hit rate limits.
3. **OpenRouter (Tertiary):** Model `meta-llama/llama-3.3-70b-instruct`.
4. **Deterministic Rule Engine (Final Fallback):** If all AI providers fail or network is offline, the agent executes real Python tools deterministically using the P2-06 `DecisionResult` strategy and produces structured markdown advisories without hallucinating AI status.

---

## Section F: Marine Data Sources & Provenance

| Data Source | Entity / Dataset ID | Data Retrievable | Geographic & Temporal Coverage | Caching / SLA Policy | Attribution & License |
|-------------|---------------------|------------------|--------------------------------|----------------------|-----------------------|
| **NOAA IBTrACS** | `noaa-ibtracs` | Historical tropical cyclone tracks, central pressures, wind speeds, SSHS categories. | North Indian Ocean (Arabian Sea & Bay of Bengal); 1980–present (retrospective). | Static archive; no TTL expiration; persistent in `hazards` and `hazard_tracks`. | NOAA / WMO Public Domain. |
| **GDACS** | `gdacs-tc` | Active tropical cyclone alerts, alert level (Green/Orange/Red), alert score, report URLs. | Global tropical cyclones; filtered to Indian Ocean bounding box; real-time. | 6-hour SLA threshold; on-demand refresh permitted; persisted in `hazards`. | UN / European Commission GDACS Open Data. |
| **Open-Meteo Marine** | `open-meteo-marine` | Significant wave height ($H_s$), wave period ($T_p$), direction, wind wave height, swell wave height. | Global oceans; 0.1° gridded resolution; hourly for 7 days ahead. | 12-hour SLA threshold; persisted in `marine_forecasts`. | Open-Meteo / ECMWF (Non-commercial / CC-BY 4.0). |
| **NOAA NHC** | `noaa-nhc` | Tropical cyclone forecast advisory runs, 120h waypoint forecasts, wind radii. | Atlantic and Eastern Pacific basins only. **Indian Ocean is OUT OF COVERAGE.** | 6-hour SLA threshold; persisted in `cyclone_forecast_runs`. | NOAA National Hurricane Center Public Domain. |

---

## Section G: Database Schema & Data Inventory

### Summary Table of `orca_db`

```text
Database: orca_db
Host: localhost:5432
User: orca
PostgreSQL Version: 18.6
Current Alembic Revision: a1d8b97152ca
```

| Table Name | Rows in `orca_db` | Role / Ownership | Export Status |
|------------|-------------------|------------------|---------------|
| `hazards` | 1,865 | Person 2 Core | Included in `person2_database.dump` |
| `hazard_tracks` | 62,874 | Person 2 Core | Included in `person2_database.dump` |
| `marine_forecasts` | 387 | Person 2 Core | Included in `person2_database.dump` |
| `cyclone_forecast_runs` | 4 | Person 2 Core | Included in `person2_database.dump` |
| `cyclone_forecast_positions` | 27 | Person 2 Core | Included in `person2_database.dump` |
| `alembic_version` | 1 | Shared Migration Head | Included in `person2_database.dump` |
| `datasets` | 0 | Shared Platform | Excluded (empty) |
| `evidence_records` | 0 | Shared Platform | Excluded (empty) |
| `investigations` | 0 | Shared Platform | Excluded (empty) |
| `execution_events` | 0 | Shared Platform | Excluded (empty) |
| `findings` | 0 | Shared Platform | Excluded (empty) |
| `finding_evidence_link` | 0 | Shared Platform | Excluded (empty) |
| `geographic_features` | 0 | Shared Platform | Excluded (empty) |
| `marine_observations` | 0 | Shared Platform | Excluded (empty) |
| `verifications` | 0 | Shared Platform | Excluded (empty) |

---

## Section H: Frontend Integration Guide

### 1. API Configuration
In `frontend/src/features/hazard-demo/api.ts` (or shared Axios client):
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
```

### 2. Primary Consumer Components
- **`MarineHazardAgentPanel.tsx`:** The conversational chat panel. Sends `HazardAgentChatRequest` to `/api/v1/hazards/agent/chat`. Renders assistant badges (`GROQ — LLM Tool-Calling Active`), markdown answers, tool executions, and clickable evidence pills (`[ev-marine-wave-...]`).
- **`CycloneMap.tsx`:** Consumes `/api/v1/hazards/{hazard_id}/track` to render historical storm paths and live cyclone positions with category-colored markers (Green = Depression, Orange = Severe Cyclonic Storm, Red = Super Cyclone).
- **`CycloneTrackTimeline.tsx`:** Controls temporal animation playback across cyclone track points.
- **`MarineForecastPanel.tsx`:** Queries `/api/v1/forecasts/marine` to render wave height area charts and sea state tables.

### 3. Suggested Workspace Placement in Main App
- In `frontend/src/app/router.tsx`:
  - Route `/hazard-demo` renders `HazardDemoWorkspace`.
  - Alternatively, Person 2 components can be embedded directly into `DisasterManagementWorkspace` or `FishermanWorkspace` by importing `<MarineHazardAgentPanel />` and `<CycloneMap />`.

---

## Section I: Integration Checklist

Follow this checklist to integrate Person 2 into your local or production environment:

1. [ ] **Extract Package:** Unzip `orca-person2-handoff.zip` into your repository.
2. [ ] **Configure Environment Variables:**
   Create `.env` in the root (copied from `.env.example`):
   ```env
   DATABASE_URL=postgresql+psycopg://orca:orca@localhost:5432/orca_db
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-flash-latest
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```
3. [ ] **Verify Database Safety:** Ensure database connection string targets `orca_db` (or a dedicated integration database like `orca_integration`). **NEVER connect to `orca`.**
4. [ ] **Apply Migrations:**
   ```bash
   cd backend
   alembic upgrade head
   ```
5. [ ] **Restore Database Data:**
   ```bash
   pg_restore -h localhost -p 5432 -U orca -d orca_db \
     --data-only --no-owner --no-privileges \
     handoff/person2/person2_database.dump
   ```
6. [ ] **Run Automated Tests:**
   ```bash
   ./backend/.venv/bin/pytest backend/tests/ -v
   ```
   *Expected: 120 tests passed.*
7. [ ] **Run Frontend Build Check:**
   ```bash
   cd frontend && npm run build
   ```
   *Expected: Built in ~6s with 0 errors.*
8. [ ] **Start Servers:**
   - Backend: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
   - Frontend: `npm run dev` (running on `http://localhost:5173`)
9. [ ] **Verify Browser Interface:**
   Navigate to `http://localhost:5173/hazard-demo`. Ask: *"What are the sea conditions off Mangaluru?"* Verify green badge `[GROQ — LLM Tool-Calling Active (openai/gpt-oss-120b)]` and wave metrics.

---

## Section J: Handover Notes & Unresolved Decisions

### 1. Critical Assumptions & Facts
- **Location Precedence:** The agent explicitly extracts city names (Mangaluru, Chennai, Mumbai, Kochi, etc.) from user messages. Explicit message names take precedence over the dropdown anchor.
- **Wave Height Metric Consistency:** The marine forecast returns both `peak_wave_height_m` and `max_wave_height_m` to ensure seamless compatibility with comparison tools.
- **Evidence Isolation:** Switching geographic locations (Mangaluru $\rightarrow$ Chennai) automatically clears the previous location's evidence pool in the session, preventing cross-contamination.

### 2. Integration Decisions Requiring Teammate Confirmation
- **Workspace Navigation:** Currently, Person 2 features are showcased in the `/hazard-demo` route. Confirm whether your team wants `/hazard-demo` retained as an executive dashboard or merged into `/disaster-management` and `/fisherman`.
- **Orchestrator Routing:** In `backend/app/orchestrator/planner.py`, ensure queries matching keywords `wave`, `cyclone`, `tsunami`, `sea state`, and `storm surge` route to the `marine_hazard` agent.
