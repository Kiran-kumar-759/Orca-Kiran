#!/usr/bin/env python3
"""
ORCA Coastal Infrastructure & Protected Areas Ingestion Script (Idempotent)
Ingests settlements, port features, and protected areas into PostgreSQL.
"""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models import GeographicFeature
except ImportError as e:
    print(f"[ERROR] Import failure: {e}")
    sys.exit(1)


def seed_coastal_data():
    print("=== Ingesting Baseline Coastal Geography (Idempotent) ===")
    db = SessionLocal()
    try:
        features = [
            {
                "id": "geo-port-new-mangalore",
                "name": "New Mangalore Port",
                "feature_type": "port",
                "latitude": 12.9347,
                "longitude": 74.8211,
                "state": "Karnataka",
                "population": None,
                "properties": {"berths": 16, "category": "Major Port"}
            },
            {
                "id": "geo-settlement-karwar",
                "name": "Karwar Coastal Settlement",
                "feature_type": "settlement",
                "latitude": 14.8136,
                "longitude": 74.1298,
                "state": "Karnataka",
                "population": 150000,
                "properties": {"coastal_buffer_zone": "CRZ-II"}
            },
            {
                "id": "geo-mpa-netrani-island",
                "name": "Netrani Island Marine Biodiversity Zone",
                "feature_type": "protected_area",
                "latitude": 14.0175,
                "longitude": 74.3278,
                "state": "Karnataka",
                "population": 0,
                "properties": {"ecosystem": "Coral reef & pelagic nursery", "designation": "Ecologically Sensitive Area"}
            }
        ]

        for item in features:
            existing = db.query(GeographicFeature).filter(GeographicFeature.id == item["id"]).first()
            if not existing:
                gf = GeographicFeature(
                    id=item["id"],
                    name=item["name"],
                    feature_type=item["feature_type"],
                    latitude=item["latitude"],
                    longitude=item["longitude"],
                    state=item["state"],
                    population=item["population"],
                    properties=item["properties"]
                )
                db.add(gf)
                print(f"[OK] Seeded feature: {item['name']} ({item['feature_type']})")
            else:
                print(f"[INFO] Feature '{item['id']}' already exists.")

        db.commit()
    except Exception as e:
        print(f"[ERROR] Coastal ingestion failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_coastal_data()
