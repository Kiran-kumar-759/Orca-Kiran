#!/usr/bin/env python3
"""
ORCA Marine Hazard Data Ingestion Script (Idempotent)
Ingests historical tropical cyclone tracks from NOAA IBTrACS into PostgreSQL.
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.db.repositories.hazard_repo import HazardRepository
    from app.providers.data.ibtracs import IBTrACSClient
except ImportError as e:
    print(f"[ERROR] Import failure: {e}")
    sys.exit(1)


def seed_hazard_data():
    print("=== Ingesting Real NOAA IBTrACS Cyclone Dataset (Idempotent) ===")
    sample_csv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/processed/ibtracs_arabian_sea_sample.csv"))
    
    client = IBTrACSClient(sample_filepath=sample_csv_path)
    hazards = client.load_local_dataset()
    
    if not hazards:
        print(f"[WARN] No hazards parsed from {sample_csv_path}")
        return

    print(f"[INFO] Parsed {len(hazards)} cyclone events from real NOAA IBTrACS archive.")
    
    db = SessionLocal()
    try:
        repo = HazardRepository(db)
        total_points = 0
        for h in hazards:
            saved = repo.upsert_hazard(
                hazard_read=h,
                metadata_json={
                    "source": "NOAA IBTrACS v04r01",
                    "basin": h.basin,
                    "first_observed": h.first_observed.isoformat() if h.first_observed else None,
                    "last_observed": h.last_observed.isoformat() if h.last_observed else None,
                }
            )
            count = len(saved.track_points)
            total_points += count
            print(f"[OK] Ingested {saved.name} ({saved.id}) with {count} chronologically ordered track points.")

        print(f"[SUCCESS] Ingestion completed. Total track points in database: {total_points}")
    except Exception as e:
        print(f"[ERROR] Hazard ingestion failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_hazard_data()
