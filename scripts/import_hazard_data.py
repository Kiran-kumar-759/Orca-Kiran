#!/usr/bin/env python3
"""
ORCA Historical Cyclone Data Import Pipeline (Idempotent)
Ingests official NOAA IBTrACS North Indian Ocean (v04r01) historical cyclone tracks into PostgreSQL.
Target Database: orca_db
"""

import argparse
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

try:
    from app.core.config import settings
    from app.db.repositories.hazard_repo import HazardRepository
    from app.db.session import SessionLocal
    from app.providers.data.ibtracs import IBTrACSClient
    from sqlalchemy import text
except ImportError as e:
    print(f"[ERROR] Import failure. Ensure backend virtual environment is active: {e}")
    sys.exit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest NOAA IBTrACS historical cyclone tracks into PostgreSQL (orca_db)"
    )
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Path to IBTrACS CSV dataset. Defaults to data/raw/ibtracs.NI.list.v04r01.csv if present, else sample.",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Explicitly download official NOAA IBTrACS North Indian Ocean dataset from NCEI before importing.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate parsing, validation, and database operations without committing any writes.",
    )
    parser.add_argument(
        "--basin",
        type=str,
        default=None,
        choices=["arabian_sea", "bay_of_bengal", "all"],
        help="Filter cyclones by basin (arabian_sea, bay_of_bengal, or all).",
    )
    parser.add_argument(
        "--limit-storms",
        type=int,
        default=None,
        help="Limit processing to first N unique storms (useful for bounded batches or smoke tests).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of storms to process per database transaction checkpoint (default: 50).",
    )
    return parser.parse_args()


def run_import() -> int:
    args = parse_args()
    start_time_utc = datetime.now(UTC)
    t0 = time.time()

    print("================================================================================")
    print("ORCA — NOAA IBTrACS Historical Cyclone Ingestion Pipeline")
    print(f"Timestamp (UTC): {start_time_utc.isoformat()}")
    print(f"Dry-run Mode:    {args.dry_run}")
    print("================================================================================")

    # 1. Verify Database Identity & Safety
    db = SessionLocal()
    try:
        cur_db, cur_user = db.execute(text("SELECT current_database(), current_user;")).fetchone()
        print(f"[DATABASE CHECK] Connected to: '{cur_db}' as user: '{cur_user}'")
        if cur_db != "orca_db":
            print(f"[CRITICAL ABORT] Safety Gate Violation: Connected to '{cur_db}', NOT 'orca_db'!")
            print("Never run ingestion against any database other than 'orca_db'.")
            return 1
    except Exception as e:
        print(f"[ERROR] Failed database connectivity verification: {e}")
        return 1
    finally:
        db.close()

    # 2. Source Selection / Download
    client = IBTrACSClient()
    source_path: Path

    if args.download:
        print("[INFO] --download specified: Fetching official NOAA IBTrACS North Indian Ocean dataset...")
        dest = Path("data/raw/ibtracs.NI.list.v04r01.csv")
        try:
            source_path, checksum = client.download_official_dataset(dest, force_redownload=True)
            print(f"[OK] Downloaded official dataset to: {source_path}")
            print(f"[OK] SHA-256 Checksum: {checksum}")
        except Exception as e:
            print(f"[ERROR] Failed to download dataset: {e}")
            return 1
    elif args.source:
        source_path = Path(args.source)
    else:
        # Default fallback priority: raw full dataset -> processed sample
        raw_default = Path("data/raw/ibtracs.NI.list.v04r01.csv")
        sample_default = Path("data/processed/ibtracs_arabian_sea_sample.csv")
        if raw_default.exists() and raw_default.stat().st_size > 1000000:
            source_path = raw_default
        elif sample_default.exists():
            source_path = sample_default
        else:
            print("[INFO] No local dataset found. Downloading official dataset...")
            source_path, _ = client.download_official_dataset(raw_default)

    if not source_path.exists():
        print(f"[ERROR] Source file does not exist: {source_path}")
        return 1

    print(f"[SOURCE] File: {source_path.resolve()}")
    print(f"[SOURCE] Size: {source_path.stat().st_size:,} bytes")

    # 3. Parse & Validate
    basin_filter = None if args.basin in (None, "all") else args.basin
    print(f"[PARSER] Basin Filter: {basin_filter or 'All North Indian Subbasins'}")
    print(f"[PARSER] Storm Limit:   {args.limit_storms or 'All Available'}")

    try:
        hazards, parse_stats = client.load_file_with_stats(
            filepath=source_path,
            basin_filter=basin_filter,
            limit_storms=args.limit_storms,
        )
    except Exception as e:
        print(f"[ERROR] Dataset parsing failed: {e}")
        return 1

    print("--------------------------------------------------------------------------------")
    print("PARSER & VALIDATION SUMMARY")
    print(f"  Source File Checksum (SHA256):     {parse_stats.get('file_sha256')}")
    print(f"  Total Data Rows Examined:          {parse_stats.get('total_rows_read'):,}")
    print(f"  Valid Track Points Parsed:         {parse_stats.get('valid_track_points'):,}")
    print(f"  Unique Cyclone Events:             {parse_stats.get('total_storms'):,}")
    print(f"  Skipped (Missing SID):             {parse_stats.get('skipped_missing_sid'):,}")
    print(f"  Skipped (Invalid Coordinates):     {parse_stats.get('skipped_invalid_coords'):,}")
    print(f"  Skipped (Out of Latitude Range):   {parse_stats.get('skipped_out_of_range'):,}")
    print(f"  Skipped (Invalid Timestamp):       {parse_stats.get('skipped_invalid_timestamp'):,}")
    print(f"  Skipped (Basin Filter):            {parse_stats.get('skipped_basin_filter'):,}")
    print(f"  Duplicate Timestamps (Deduplicated): {parse_stats.get('duplicate_timestamps'):,}")
    print("--------------------------------------------------------------------------------")

    if not hazards:
        print("[WARN] No valid hazard records parsed from source.")
        return 0

    # 4. Ingest into PostgreSQL orca_db
    print(f"[INGESTION] Target Database: orca_db (Batch Size: {args.batch_size})")
    if args.dry_run:
        print("[INGESTION] DRY-RUN ACTIVE: Testing transaction logic; NO writes will be committed.")

    db = SessionLocal()
    try:
        repo = HazardRepository(db)
        initial_event_count = repo.count_hazards()
        initial_track_count = repo.count_hazard_tracks()

        db_summary = repo.upsert_hazards_batch(
            hazards=hazards,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            default_metadata={
                "ingestion_source": "NOAA IBTrACS v04r01 (NCEI)",
                "source_file": str(source_path.name),
                "source_file_sha256": parse_stats.get("file_sha256"),
                "ingestion_timestamp_utc": start_time_utc.isoformat(),
            },
        )

        final_event_count = repo.count_hazards()
        final_track_count = repo.count_hazard_tracks()

    except Exception as e:
        print(f"[FATAL] Ingestion transaction failed: {e}")
        db.rollback()
        return 1
    finally:
        db.close()

    elapsed = time.time() - t0
    end_time_utc = datetime.now(UTC)

    print("================================================================================")
    print("DATABASE INGESTION OUTCOME")
    print(f"  Database Target:              orca_db")
    print(f"  Dry-run:                      {args.dry_run}")
    print(f"  Events Inserted:              {db_summary['events_inserted']:,}")
    print(f"  Events Updated:               {db_summary['events_updated']:,}")
    print(f"  Events Unchanged:             {db_summary['events_unchanged']:,}")
    print(f"  Track Points Inserted:        {db_summary['points_inserted']:,}")
    print(f"  Track Points Updated:         {db_summary['points_updated']:,}")
    print(f"  Track Points Unchanged:       {db_summary['points_unchanged']:,}")
    print(f"  Pre-Ingestion DB Totals:      {initial_event_count:,} events, {initial_track_count:,} points")
    print(f"  Post-Ingestion DB Totals:     {final_event_count:,} events, {final_track_count:,} points")
    print(f"  Execution Time:               {elapsed:.2f} seconds")
    print(f"  Completed At (UTC):           {end_time_utc.isoformat()}")
    print("================================================================================")

    if args.dry_run:
        print("[SUCCESS] Dry-run completed successfully with zero database modifications.")
    else:
        print("[SUCCESS] Idempotent ingestion into orca_db completed successfully.")

    return 0


if __name__ == "__main__":
    sys.exit(run_import())
