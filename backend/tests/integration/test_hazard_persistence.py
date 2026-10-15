from datetime import UTC, datetime
from pathlib import Path

from app.db.base import Base
from app.db.repositories.hazard_repo import HazardRepository
from app.providers.data.ibtracs import IBTrACSClient
from app.schemas.hazard import HazardRead, HazardTrackPoint
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_hazard_repository_idempotent_upsert():
    # Use in-memory SQLite database to test HazardRepository logic in isolation
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    repo = HazardRepository(session)

    sample_hazard = HazardRead(
        hazard_id="hz-test-idempotent",
        name="Cyclone Test",
        type="cyclone",
        source="NOAA IBTrACS",
        basin="arabian_sea",
        status="historical",
        first_observed=datetime(2021, 5, 14, 0, 0, tzinfo=UTC),
        last_observed=datetime(2021, 5, 16, 0, 0, tzinfo=UTC),
        track_points=[
            HazardTrackPoint(
                time=datetime(2021, 5, 14, 6, 0, tzinfo=UTC),
                latitude=11.2,
                longitude=72.2,
                wind_speed_knots=35.0,
                pressure_hpa=998.0,
                category="Tropical Storm",
                is_forecast=False,
            ),
            HazardTrackPoint(
                time=datetime(2021, 5, 15, 6, 0, tzinfo=UTC),
                latitude=13.3,
                longitude=73.0,
                wind_speed_knots=65.0,
                pressure_hpa=980.0,
                category="Category 1",
                is_forecast=False,
            ),
        ],
    )

    # 1. First insert
    saved1 = repo.upsert_hazard(sample_hazard)
    assert saved1.id == "hz-test-idempotent"
    assert len(saved1.track_points) == 2

    # 2. Second insert with exact same data (must be idempotent and not create duplicates)
    saved2 = repo.upsert_hazard(sample_hazard)
    assert saved2.id == "hz-test-idempotent"
    assert len(saved2.track_points) == 2

    # 3. Query via list_hazards
    results = repo.list_hazards(basin="arabian_sea")
    assert len(results) == 1
    assert results[0].hazard_id == "hz-test-idempotent"
    assert len(results[0].track_points) == 2

    session.close()


def test_import_script_repeatability():
    """Verify that importing the real Arabian Sea sample multiple times produces consistent, non-duplicated records."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    repo = HazardRepository(session)

    sample_csv = Path(__file__).resolve().parents[3] / "data" / "processed" / "ibtracs_arabian_sea_sample.csv"
    assert sample_csv.exists(), f"Sample CSV {sample_csv} must exist"

    client = IBTrACSClient(sample_filepath=str(sample_csv))
    hazards = client.load_local_dataset()
    assert len(hazards) >= 1

    # First run of import
    for h in hazards:
        repo.upsert_hazard(h)
    
    hazards_pass1 = repo.list_hazards(basin="arabian_sea")
    assert len(hazards_pass1) == 1
    track_count_1 = len(hazards_pass1[0].track_points)
    assert track_count_1 == 49

    # Second run of import with same data
    for h in hazards:
        repo.upsert_hazard(h)

    hazards_pass2 = repo.list_hazards(basin="arabian_sea")
    assert len(hazards_pass2) == 1
    track_count_2 = len(hazards_pass2[0].track_points)
    assert track_count_2 == track_count_1  # No duplicate track points!

    session.close()
