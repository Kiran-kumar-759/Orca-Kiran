# ORCA — Person 2: Historical Cyclone Explorer & Hazard Query Layer

## 1. Overview
The **Historical Cyclone Explorer** is a database-backed marine hazard intelligence interface developed under **Person 2 (Marine Hazard & Forecast Agent)**. It allows interactive exploration, searching, spatial/intensity filtering, and chronological track inspection of 1,859 historical North Indian Ocean cyclones and 62,864 observation track points persisted in PostgreSQL `orca_db`.

> **Note on Data Provenance & Safety**:
> This feature visualizes verified historical observations from the official NOAA/NCEI IBTrACS archive (1842–2026). It does **not** provide live GDACS alerts, predictive forecast cones, or future trajectory extrapolations (which belong to subsequent phases).

---

## 2. Running Locally

### Backend Server (FastAPI)
```bash
cd /home/ckirankumar/orca/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Base: `http://localhost:8000/api/v1`
- Swagger Docs: `http://localhost:8000/docs`

### Frontend Application (Vite + React)
```bash
cd /home/ckirankumar/orca/frontend
npm run dev
```
- Web Application: `http://localhost:5173`
- Historical Cyclone Explorer Demo Route: `http://localhost:5173/hazard-demo`

---

## 3. Configuration & Environment Variables
The application uses the following environment variables (configured via `.env`):
- `DATABASE_URL`: PostgreSQL connection string pointing to `orca_db`.
- `ENVIRONMENT`: Runtime mode (`development` or `production`).
- `VITE_API_BASE_URL`: Frontend API base URL (defaults to `http://localhost:8000/api/v1`).

*Never commit `.env` or print secret values in logs.*

---

## 4. API Endpoints Specification

### A. `GET /api/v1/hazards`
Paginated search and filter for historical cyclone events.

**Query Parameters:**
- `search` (string, optional): Search by storm name (e.g. `Tauktae`) or storm SID (e.g. `2021133N10071`).
- `basin` (string, optional): Filter by basin (`arabian_sea`, `bay_of_bengal`, or `all`).
- `status` (string, optional): Filter by status (`historical`, `active`).
- `active_only` (boolean, default: `false`): Backward-compatible active alert filter.
- `start_date` (ISO-8601 UTC datetime, optional): Observation start time.
- `end_date` (ISO-8601 UTC datetime, optional): Observation end time.
- `min_wind` (float, optional): Filter for storms reaching minimum wind speed in knots.
- `category` (string, optional): Saffir-Simpson category (`Tropical Storm`, `Category 1`–`Category 5`).
- `sort_by` (string, default: `last_observed`): Allowlist: `last_observed`, `first_observed`, `name`, `id`, `created_at`.
- `sort_order` (string, default: `desc`): `desc` or `asc`.
- `page` (integer, default: `1`): 1-indexed page number.
- `limit` (integer, default: `20`, max: `100`): Results per page.
- `include_tracks` (boolean, default: `true`): Include track points array.

**Example Request:**
```bash
curl "http://localhost:8000/api/v1/hazards?search=Tauktae&limit=5&include_tracks=false"
```

**Example Response:**
```json
{
  "count": 1,
  "items": [
    {
      "hazard_id": "hz-ibtracs-2021133n10071",
      "name": "Cyclone Tauktae",
      "type": "cyclone",
      "source": "NOAA IBTrACS",
      "basin": "arabian_sea",
      "status": "historical",
      "first_observed": "2021-05-13T11:30:00+05:30",
      "last_observed": "2021-05-19T11:30:00+05:30",
      "track_points": []
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 5,
  "pages": 1
}
```

### B. `GET /api/v1/hazards/{hazard_id}`
Retrieve full details and track progression for a single hazard event. Returns `404` if absent.

### C. `GET /api/v1/hazards/{hazard_id}/track`
Retrieve chronologically ordered track points with stable tie-breaker.

**Example Response:**
```json
{
  "hazard_id": "hz-ibtracs-2021133n10071",
  "name": "Cyclone Tauktae",
  "count": 49,
  "track_points": [
    {
      "time": "2021-05-13T11:30:00+05:30",
      "latitude": 10.0,
      "longitude": 70.9,
      "wind_speed_knots": 20.0,
      "pressure_hpa": 1007.0,
      "category": "Tropical Depression",
      "is_forecast": false
    }
  ]
}
```

### D. `GET /api/v1/hazards/{hazard_id}/stats`
Returns derived aggregate intensity and duration statistics strictly computed from valid non-null observations.

---

## 5. Units & Standards Convention
- **Coordinate System**: WGS84 decimal degrees (`[-90.0, 90.0]` latitude, `[-180.0, 180.0]` longitude).
- **Wind Speed**: Knots (`kts`).
- **Atmospheric Pressure**: Hectopascals (`hPa`) / millibars (`mb`).
- **Timestamps**: Timezone-aware UTC ISO-8601 datetimes.
- **Missing Values**: Preserved explicitly as `null`/`None` in database and JSON APIs; displayed as `"N/A"` in UI (never zero-coerced).

---

## 6. Automated Testing

### Backend Unit & Integration Tests
```bash
# Run all 39 tests across the repository
backend/.venv/bin/pytest backend/tests -v

# Run API endpoint tests
backend/.venv/bin/pytest backend/tests/api/test_hazards_api.py -v

# Run PostgreSQL transaction rollback integration tests
backend/.venv/bin/pytest backend/tests/integration/test_hazard_persistence.py -v
```

### Frontend Type Check & Build
```bash
npm run build --prefix frontend
```

---

## 7. Known Limitations
1. **Historical Only**: Current data represents verified historical best-track archives from NOAA IBTrACS NI (1842–2026). Live GDACS alert streams and numerical weather forecast integrations will be introduced in subsequent phases (P2-03).
2. **Headless Browser Driver Limitation**: Automated Playwright browser installation is blocked by external CDN 404 in this Fedora Linux environment. Visual and functional verification was confirmed through direct HTTP curl against running Vite/FastAPI services, unit tests, and production build verification.
