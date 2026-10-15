#!/usr/bin/env python3
"""
ORCA Marine Hazard Data Ingestion Script (Idempotent)
Ingests historical and active cyclone track datasets into PostgreSQL.
"""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models import Hazard, HazardTrack
except ImportError as e:
    print(f"[ERROR] Import failure: {e}")
    sys.exit(1)


def seed_hazard_data():
    print("=== Ingesting Baseline Cyclone / Hazard Dataset (Idempotent) ===")
    db = SessionLocal()
    try:
        hazard_id = "hz-ibtracs-tauktae"
        existing_hz = db.query(Hazard).filter(Hazard.id == hazard_id).first()
        if not existing_hz:
            hz = Hazard(
                id=hazard_id,
                name="Extremely Severe Cyclonic Storm Tauktae",
                hazard_type="cyclone",
                source="NOAA IBTrACS",
                basin="arabian_sea",
                status="historical",
                first_observed=datetime(2021, 5, 14, 0, 0, tzinfo=timezone.utc),
                last_observed=datetime(2021, 5, 19, 12, 0, tzinfo=timezone.utc)
            )
            db.add(hz)
            db.commit()

            # Add track point
            tp = HazardTrack(
                id=f"{hazard_id}-pt1",
                hazard_id=hazard_id,
                time=datetime(2021, 5, 15, 6, 0, tzinfo=timezone.utc),
                latitude=12.2,
                longitude=72.8,
                wind_speed_knots=70.0,
                pressure_hpa=978.0,
                category="Category 1",
                is_forecast=False
            )
            db.add(tp)
            db.commit()
            print(f"[OK] Seeded historical cyclone: {hazard_id}")
        else:
            print(f"[INFO] Hazard '{hazard_id}' already present.")
    except Exception as e:
        print(f"[ERROR] Hazard ingestion failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_hazard_data()
