# ORCA Team Integration Guide

This guide ensures seamless collaboration among all three teammates working on the unified ORCA platform.

## 1. Team Responsibilities Matrix

- **Person 1:** Ocean Intelligence & Research Agent (`backend/app/agents/ocean_research/agent.py`) + Marine data integrations (`scripts/import_marine_data.py`).
- **Person 2:** Marine Hazard & Forecast Agent (`backend/app/agents/marine_hazard/agent.py`) + Hazard data integrations (`scripts/import_hazard_data.py`).
- **Person 3:** Coastal Impact & Risk Agent (`backend/app/agents/coastal_risk/agent.py`) + Evidence & Scientific Verification Agent (`backend/app/agents/evidence_verification/agent.py`) + Orchestrator coordination (`backend/app/orchestrator/`).

---

## 2. Rules of Engagement

1. **Shared Contracts are Immutable:**
   - Do not edit `InvestigationTask`, `AgentResult`, `Finding`, or `EvidenceRecord` without team consensus.
   - Do not modify database migration heads independently. Coordinate all Alembic versions.
2. **Importable Modules Only:**
   - Implement your agent as an importable class in `backend/app/agents/<agent_name>/agent.py` implementing `SpecialistAgent`.
3. **No Standalone Databases:**
   - Connect only to the single shared PostgreSQL instance configured via `DATABASE_URL`.
4. **Idempotent Imports:**
   - When seeding or importing records, ensure primary keys or unique constraints prevent duplicate insertions on repeated script runs.

---

## 3. Step-by-Step Integration Checklist

1. **Pull Latest Changes:**
   ```bash
   git pull origin main
   ```
2. **Activate Backend Virtual Environment:**
   ```bash
   source backend/.venv/bin/activate
   ```
3. **Verify Database Migrations:**
   ```bash
   cd backend
   alembic upgrade head
   ```
4. **Run Automated Test Suite:**
   ```bash
   pytest
   ```
5. **Verify Frontend Build:**
   ```bash
   cd ../frontend
   npm run build
   ```
6. **Open PR / Feature Branch:**
   - Branch naming convention: `feature/<role>-<agent_name>`
   - Include test evidence in your PR description.
