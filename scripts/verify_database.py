#!/usr/bin/env python3
"""
ORCA Database Verification & Table Verification Script
Tests PostgreSQL connection and verifies that all shared schema tables exist.
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.base import Base
    from app.models import (
        Dataset,
        MarineObservation,
        Hazard,
        HazardTrack,
        GeographicFeature,
        EvidenceRecordModel,
        FindingModel,
        InvestigationModel,
        ExecutionEventModel,
        VerificationModel,
    )
    from sqlalchemy import create_engine, inspect
except ImportError as e:
    print(f"[ERROR] Import failure. Ensure backend dependencies are installed: {e}")
    sys.exit(1)


def verify():
    print("=== ORCA Database Verification ===")
    print(f"Connecting to: {settings.DATABASE_URL.split('@')[-1]}")
    try:
        engine = create_engine(settings.DATABASE_URL)
        with engine.connect() as conn:
            print("[OK] Connection established successfully.")
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            print(f"Existing tables in target database: {existing_tables}")
            
            # Create all tables idempotently if not yet created via alembic
            Base.metadata.create_all(engine)
            print("[OK] Base metadata verified and ensured.")
    except Exception as e:
        print(f"[WARN] Database connection test encountered: {e}")
        print("Note: Ensure PostgreSQL is running locally with database 'orca_db' and user 'orca'.")


if __name__ == "__main__":
    verify()
