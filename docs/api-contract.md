# ORCA Shared API Contract Specification

All endpoints are hosted under prefix `/api/v1` and served via FastAPI.

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health and database connectivity check |
| `GET` | `/api/v1/marine/observations` | Query filtered oceanographic observations |
| `GET` | `/api/v1/hazards` | Query cyclone events, forecast tracks, and hazard records |
| `POST` | `/api/v1/investigations` | Submit a new multi-agent investigation request |
| `GET` | `/api/v1/investigations/{investigation_id}` | Fetch current status and aggregated result |
| `GET` | `/api/v1/investigations/{investigation_id}/events` | Fetch ordered genuine execution events |
| `GET` | `/api/v1/investigations/{investigation_id}/evidence` | Fetch all verifiable evidence records linked to the investigation |
| `GET` | `/api/v1/investigations/{investigation_id}/report` | Fetch verified markdown scientific report |

---

## Detailed Endpoint Schemas

### 1. `GET /health`
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "providers": {
    "groq": "configured",
    "gemini": "unconfigured",
    "openrouter": "unconfigured"
  },
  "timestamp": "2026-10-15T14:00:00Z"
}
```

### 2. `GET /api/v1/marine/observations`
- **Query Parameters**:
  - `latitude` (float, optional): Latitude in decimal degrees [-90, 90]
  - `longitude` (float, optional): Longitude in decimal degrees [-180, 180]
  - `radius_km` (float, default: 50.0): Bounding radius
  - `variable` (string, optional): e.g. `sst`, `wave_height`, `wind_speed`, `chlorophyll`
  - `start_time` (ISO8601 UTC, optional)
  - `end_time` (ISO8601 UTC, optional)
  - `limit` (integer, default: 50, max: 500)
- **Response `200 OK`**:
```json
{
  "count": 1,
  "items": [
    {
      "id": "obs-001",
      "dataset_id": "open-meteo-marine",
      "variable": "wave_height",
      "value": 1.8,
      "unit": "m",
      "latitude": 12.91,
      "longitude": 74.85,
      "observation_time": "2026-10-15T06:00:00Z",
      "retrieval_time": "2026-10-15T06:05:00Z",
      "quality_flag": "good",
      "is_forecast": true
    }
  ]
}
```

### 3. `GET /api/v1/hazards`
- **Query Parameters**:
  - `hazard_type` (string, optional): `cyclone`, `storm_surge`, `extreme_waves`
  - `basin` (string, optional): e.g. `arabian_sea`, `bay_of_bengal`
  - `active_only` (bool, default: false)
  - `limit` (integer, default: 20)
- **Response `200 OK`**:
```json
{
  "count": 1,
  "items": [
    {
      "hazard_id": "hz-2026-01",
      "name": "Severe Cyclonic Storm 01A",
      "type": "cyclone",
      "source": "NOAA IBTrACS / IMD",
      "basin": "arabian_sea",
      "status": "historical",
      "first_observed": "2026-10-10T00:00:00Z",
      "last_observed": "2026-10-14T12:00:00Z",
      "track_points": [
        {
          "time": "2026-10-12T00:00:00Z",
          "latitude": 13.5,
          "longitude": 70.2,
          "wind_speed_knots": 65,
          "pressure_hpa": 982,
          "category": "Cat 1",
          "is_forecast": false
        }
      ]
    }
  ]
}
```

### 4. `POST /api/v1/investigations`
- **Request Body**:
```json
{
  "workspace": "fisherman",
  "query": "Offshore fishing near Mangaluru tomorrow morning. Check wave/wind conditions and warnings.",
  "location": {
    "latitude": 12.91,
    "longitude": 74.85,
    "name": "Offshore Mangaluru"
  },
  "time_window": {
    "start_time": "2026-10-16T00:00:00Z",
    "end_time": "2026-10-16T12:00:00Z"
  },
  "preferred_agents": ["ocean_research", "marine_hazard"]
}
```
- **Response `202 Accepted`**:
```json
{
  "investigation_id": "inv-9a4c10ef",
  "status": "pending",
  "workspace": "fisherman",
  "created_at": "2026-10-15T14:00:00Z",
  "message": "Investigation created and queued for execution"
}
```

### 5. `GET /api/v1/investigations/{investigation_id}`
- **Response `200 OK`**:
```json
{
  "investigation_id": "inv-9a4c10ef",
  "workspace": "fisherman",
  "status": "completed",
  "summary": "Moderate wave activity (1.6-1.9m) with light offshore winds. No active cyclone alerts.",
  "findings": [
    {
      "claim": "Maximum wave height forecasted at 1.9m off Mangaluru at 06:00 UTC",
      "value": 1.9,
      "unit": "m",
      "evidence_ids": ["ev-om-01"],
      "uncertainty": "Numerical forecast uncertainty ±0.2m",
      "is_forecast": true
    }
  ],
  "verification_summary": {
    "overall_state": "verified",
    "verified_claims_count": 1,
    "unverified_claims_count": 0,
    "notes": "Forecast timestamps and units verified against Open-Meteo records."
  },
  "limitations": [
    "Nearshore bathymetric wave shoaling effects are not modeled in deep-water grid.",
    "Official localized IMD port signals must be consulted directly before sailing."
  ],
  "created_at": "2026-10-15T14:00:00Z",
  "completed_at": "2026-10-15T14:00:06Z"
}
```
