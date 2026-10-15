#!/usr/bin/env python3
"""
ORCA Marine Data Ingestion Script (Idempotent)
Ingests physical and biological oceanographic observations into PostgreSQL.
"""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models import Dataset, MarineObservation
except ImportError as e:
    print(f"[ERROR] Import failure: {e}")
    sys.exit(1)


def seed_marine_data():
    print("=== Ingesting Baseline Marine Dataset (Idempotent) ===")
    db = SessionLocal()
    try:
        # 1. Dataset metadata
        dataset_id = "open-meteo-marine"
        existing_ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not existing_ds:
            ds = Dataset(
                id=dataset_id,
                name="Open-Meteo Marine Global Forecast",
                source_url="https://marine-api.open-meteo.com/v1/marine",
                license="CC-BY 4.0",
                temporal_coverage="Hourly forecast up to 7 days",
                spatial_coverage="Global Oceans / Arabian Sea Coastal Sector",
                variables={"wave_height": "m", "sea_surface_temperature": "°C", "wave_period": "s"}
            )
            db.add(ds)
            db.commit()
            print(f"[OK] Registered dataset: {dataset_id}")
        else:
            print(f"[INFO] Dataset '{dataset_id}' already present.")

        # 2. Idempotent sample observation
        obs_id = "obs-kar-mang-001"
        existing_obs = db.query(MarineObservation).filter(MarineObservation.id == obs_id).first()
        if not existing_obs:
            obs = MarineObservation(
                id=obs_id,
                dataset_id=dataset_id,
                variable="wave_height",
                value=1.75,
                unit="m",
                latitude=12.91,
                longitude=74.85,
                observation_time=datetime.now(timezone.utc),
                is_forecast=True,
                quality_flag="good"
            )
            db.add(obs)
            db.commit()
            print(f"[OK] Seeded observation: {obs_id}")
        else:
            print(f"[INFO] Observation '{obs_id}' already present.")

    except Exception as e:
        print(f"[ERROR] Ingestion failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_marine_data()
