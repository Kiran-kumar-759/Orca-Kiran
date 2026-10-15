# ORCA — Open-Source Marine and Coastal Intelligence Platform

ORCA is an AI-powered marine and coastal intelligence platform that collects and analyzes real marine, environmental, weather, cyclone, geographic, and population data to produce evidence-backed scientific investigations and coastal risk assessments.

ORCA combines real data retrieval, deterministic scientific calculations, geospatial analysis, collaborative AI reasoning, evidence verification, and an interactive multi-workspace interface.

---

## 1. Core Principles

- **Real Data First:** Actual observations, forecasts, and historical records from accessible data providers. Historical data is explicitly labeled; stale or missing data is never concealed.
- **Evidence-Backed Findings:** Every factual claim resolves to an immutable evidence record with provenance, timestamps, coordinates, units, and source URLs.
- **Deterministic Calculations:** Code handles distances, spatial intersections, coordinate conversions, and unit arithmetic. LLMs never fabricate math or measurements.
- **Honest Uncertainty:** Clear distinction between direct observations, forecasts, deterministic derived metrics, and AI interpretations.
- **Genuine Agent Execution:** Multi-agent pipeline emits genuine execution events reflecting true lifecycle states.

---

## 2. System Architecture

```
User Question
    │
    ▼
FastAPI API Validation & Investigation Record Creation
    │
    ▼
Shared Orchestrator
    ├── Planning: Selects appropriate specialist agents
    ├── Execution: Dispatches real provider and DB queries
    │     ├── Agent 1: Ocean Intelligence & Research
    │     ├── Agent 2: Marine Hazard & Forecast
    │     └── Agent 3: Coastal Impact & Risk
    ├── Evidence Collection: Registers verifiable evidence records
    └── Agent 4: Evidence & Scientific Verification
          ├── Verifies claims against evidence records
          └── Evaluates freshness, units, and consistency
    │
    ▼
Aggregated Result & Persisted Execution Events
    │
    ▼
Frontend Workspaces (Interactive Maps, Recharts, Evidence Inspection, Reports)
```

---

## 3. Four Specialist Agents

1. **Ocean Intelligence & Research Agent (`ocean_research`)**
   - Retrieves SST, waves, wind, currents, chlorophyll/ocean-color indicators.
   - Computes time series and anomalies against documented baselines.
2. **Marine Hazard & Forecast Agent (`marine_hazard`)**
   - Retrieves cyclone tracks (historical IBTrACS and official advisories) and marine hazard alerts.
   - Extracts structured track points and forecast timestamps without fabricating cones or intensity.
3. **Coastal Impact & Risk Agent (`coastal_risk`)**
   - Intersects hazard footprints with coastal boundaries, settlements, infrastructure, and population data.
   - Computes deterministic exposure estimates with documented methodology and spatial resolution.
4. **Evidence & Scientific Verification Agent (`evidence_verification`)**
   - Validates that every finding references existing evidence records.
   - Checks timestamps, units, geographic coverage, dataset compatibility, and calculation reproducibility.
   - Assigns verification states: `verified`, `unverified`, `needs_review`, `conflicting`, `insufficient_evidence`.

---

## 4. Five Role-Oriented Workspaces

1. **Fisherman:** Marine conditions (waves, wind, SST), hazard warnings, and safety advisories for local coastal operations.
2. **Marine Monitoring:** Long-term SST time series, ocean color/chlorophyll patterns, seasonal variations, and environmental anomaly detection.
3. **Protected Areas:** Marine protected area boundaries, environmental indicators inside/outside reserve zones, and hazard overlap.
4. **Coastal Authority:** Coastal infrastructure, settlement exposure, hazard intersection, and population impact planning.
5. **Disaster Management:** Real-time and historical cyclone track playback, multi-hazard alerts, exposure analysis, and emergency timeline reports.

---

## 5. Technology Stack

- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, PostgreSQL + Psycopg 3, HTTPX.
- **LLM Providers:** Unified provider abstraction (Groq $\rightarrow$ Gemini $\rightarrow$ OpenRouter fallback).
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Radix UI, React Router, MapLibre GL JS, Recharts.
- **Geospatial & Storage:** PostgreSQL + WGS84 coordinates (EPSG:4326), UTC timestamps.

---

## 6. Repository Layout

```
orca/
├── docs/                 # Single source of truth specifications
├── backend/              # FastAPI application, models, agents, orchestrator
│   ├── alembic/          # Database migrations
│   ├── app/              # Core application logic
│   └── tests/            # Pytest test suite
├── frontend/             # React + Vite + TypeScript application
├── scripts/              # Idempotent data import and verification tools
└── data/                 # Raw and processed local datasets
```

---

## 7. Setup and Development

See [docs/setup.md](docs/setup.md) for detailed development setup instructions.
