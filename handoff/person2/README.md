# ORCA Person 2 Integration Handoff Package: Quickstart Guide

Welcome! This handoff package contains the complete, tested implementation of the **Marine Hazard & Forecast Agent (Person 2)** for ORCA.

---

## 1. Package Contents

This folder (`handoff/person2/`) and the root archive (`orca-person2-handoff.zip`) contain:

- **`ORCA_PERSON2_INTEGRATION_HANDOFF.md`:** The comprehensive primary handoff guide detailing architecture, execution flow, data sources, tool schemas, frontend integration, and checklists. **(Start reading here!)**
- **`person2_api_contract.json`:** Validated, machine-readable JSON specification of all 16 Person 2 hazard and forecast API endpoints.
- **`person2_database_inventory.md`:** Complete schema, table ownership, constraint, foreign key, index, and row count documentation for `orca_db`.
- **`person2_database.dump`:** Verified PostgreSQL custom-format (`-Fc`) database dump containing the 5 populated Person 2 tables (1,865 hazards, 62,874 hazard track points, 387 marine forecasts, 4 cyclone forecast runs, and 27 cyclone forecast positions) plus `alembic_version`.
- **`README.md`:** This quickstart file.

---

## 2. Where to Start

1. Open and read [`ORCA_PERSON2_INTEGRATION_HANDOFF.md`](./ORCA_PERSON2_INTEGRATION_HANDOFF.md) for full context on architecture, tools, and endpoints.
2. Review [`person2_database_inventory.md`](./person2_database_inventory.md) before importing data into your integration database.
3. Consult [`person2_api_contract.json`](./person2_api_contract.json) when connecting the main ORCA frontend or the Orchestrator service.

---

## 3. What Code Is Included

- **Backend Agent:** `backend/app/agents/marine_hazard/` (`agent.py`, `session.py`) — full tool-calling conversational agent, scientific math (Douglas sea state, IMD cyclone scale), and decision planning.
- **Data Providers:** `backend/app/providers/data/` (`ibtracs.py`, `gdacs.py`, `open_meteo.py`, `nhc.py`).
- **Database Repositories & Models:** `backend/app/db/repositories/` (`hazard_repo.py`, `forecast_repo.py`) and `backend/app/models/` (`hazard.py`, `forecast.py`).
- **Endpoints & Schemas:** `backend/app/api/v1/endpoints/` (`hazards.py`, `forecasts.py`) and `backend/app/schemas/` (`hazard.py`, `forecast.py`).
- **Frontend Workspace & Components:** `frontend/src/features/hazard-demo/` (Leaflet cyclone map, timeline animation, forecast panel, and conversational specialist chat panel).
- **Test Suites:** `backend/tests/unit/test_groq_tool_calling.py`, `test_marine_hazard_agent.py`, `test_marine_data_selection.py`, and endpoint integration tests.

---

## 4. Database Dump Details

- **Dump File:** `handoff/person2/person2_database.dump`
- **Format:** PostgreSQL Custom Format (`-Fc`, compressed, 889 KB).
- **Source Database:** `orca_db` (PostgreSQL 18.6). **The protected historical database `orca` was NEVER accessed.**
- **Tables Included:**
  - `hazards` (1,865 rows)
  - `hazard_tracks` (62,874 rows)
  - `marine_forecasts` (387 rows)
  - `cyclone_forecast_runs` (4 rows)
  - `cyclone_forecast_positions` (27 rows)
  - `alembic_version` (1 row, head `a1d8b97152ca`)
- **Tables Excluded:** Shared empty platform tables (`datasets`, `evidence_records`, `investigations`, `findings`, `marine_observations`, etc.).

### How to Restore:
```bash
# 1. In your clean target integration database (e.g. orca_db):
cd backend
alembic upgrade head

# 2. Restore Person 2 data:
pg_restore -h localhost -p 5432 -U orca -d orca_db \
  --data-only --no-owner --no-privileges \
  handoff/person2/person2_database.dump
```

---

## 5. Required Configuration

Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql+psycopg://orca:orca@localhost:5432/orca_db
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-flash-latest
OPENROUTER_API_KEY=your_openrouter_api_key
```

*(Note: Never commit `.env` or API keys. If API keys are absent, the agent automatically and safely falls back to the deterministic rule engine without crashing).*

---

## 6. How to Run & Validate

### 1. Run Automated Backend Tests
```bash
./backend/.venv/bin/pytest backend/tests/ -v
```
*Expected: 120 tests pass.*

### 2. Verify Frontend Build
```bash
cd frontend && npm run build
```
*Expected: Builds successfully with 0 TypeScript errors.*

### 3. Start Development Servers
- **Backend:** `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend:** `cd frontend && npm run dev`

### 4. Test in Browser
Open `http://localhost:5173/hazard-demo`. Try asking:
- *"What are the sea conditions off Mangaluru?"*
- *"What about Chennai?"*
- *"What about tomorrow?"*
- *"Compare it with historical cyclones."*

---

## 7. Unresolved Integration Decisions for Your Confirmation

1. **Route Placement:** Confirm whether Person 2's components should stay under `/hazard-demo` or be merged into `/disaster-management` and `/fisherman`.
2. **Orchestrator Routing:** Confirm whether the Orchestrator service in `backend/app/orchestrator/planner.py` delegates marine hazard tasks to `marine_hazard`.
