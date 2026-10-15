from datetime import UTC, datetime

from app.providers.data.ibtracs import IBTrACSClient, sshs_to_category

SAMPLE_IBTRACS_CSV = """SID,SEASON,NUMBER,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_WIND,WMO_PRES,USA_SSHS
 ,Year, , , , , , ,degrees_north,degrees_east,kts,mb,1
2021133N10071,2021,30,NI,AS,TAUKTAE,2021-05-15 06:00:00,TS,13.3,73.0,45,990,0
2021133N10071,2021,30,NI,AS,TAUKTAE,2021-05-14 06:00:00,TS,11.2,72.2,25,996,-1
2021133N10071,2021,30,NI,AS,TAUKTAE,2021-05-16 12:00:00,TS,16.5,72.7,90,960,2
2021133N10071,2021,30,NI,AS,TAUKTAE,2021-05-15 06:00:00,TS,13.3,73.0,45,990,0
2021133N10071,2021,30,NI,AS,TAUKTAE,invalid-time,TS,14.0,72.8,50,985,1
2021133N10071,2021,30,NI,AS,TAUKTAE,2021-05-17 00:00:00,TS,invalid,72.8,50,985,1
"""


def test_ibtracs_parsing_and_chronological_ordering():
    client = IBTrACSClient()
    hazards = client.parse_csv(SAMPLE_IBTRACS_CSV)

    assert len(hazards) == 1
    storm = hazards[0]
    assert storm.name == "Cyclone Tauktae"
    assert storm.basin == "arabian_sea"
    assert storm.status == "historical"
    assert storm.type == "cyclone"

    # Should have 3 valid unique chronological points (one duplicate skipped, two invalid rows skipped)
    assert len(storm.track_points) == 3

    # Check chronological ordering
    times = [p.time for p in storm.track_points]
    assert times == sorted(times)
    assert times[0] == datetime(2021, 5, 14, 6, 0, tzinfo=UTC)
    assert times[-1] == datetime(2021, 5, 16, 12, 0, tzinfo=UTC)


def test_ibtracs_missing_fields_handling():
    csv_missing_fields = """SID,SEASON,NUMBER,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_WIND,WMO_PRES,USA_SSHS
 ,Year, , , , , , ,degrees_north,degrees_east,kts,mb,1
2020153N12071,2020,02,NI,AS,NISARGA,2020-06-02 00:00:00,TS,15.0,71.2, , , 
"""
    client = IBTrACSClient()
    hazards = client.parse_csv(csv_missing_fields)

    assert len(hazards) == 1
    storm = hazards[0]
    assert storm.name == "Cyclone Nisarga"
    assert len(storm.track_points) == 1
    pt = storm.track_points[0]
    assert pt.wind_speed_knots is None
    assert pt.pressure_hpa is None
    assert pt.category == "Tropical Cyclone"
    assert pt.is_forecast is False


def test_sshs_to_category_mapping():
    assert sshs_to_category(0, 45.0) == "Tropical Storm"
    assert sshs_to_category(1, 70.0) == "Category 1"
    assert sshs_to_category(2, 90.0) == "Category 2"
    assert sshs_to_category(3, 105.0) == "Category 3"
    assert sshs_to_category(4, 120.0) == "Category 4"
    assert sshs_to_category(5, 145.0) == "Category 5"
    assert sshs_to_category(-1, 25.0) == "Tropical Depression"
    assert sshs_to_category(None, 65.0) == "Category 1"
