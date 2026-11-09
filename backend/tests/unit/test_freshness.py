from datetime import UTC, datetime, timedelta

import pytest

from app.core.freshness import (
    FreshnessStatus,
    ProviderReliabilityTracker,
    SyncOutcome,
    evaluate_freshness,
)


def test_evaluate_freshness_inside_threshold():
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)
    recent_ts = now - timedelta(hours=2)
    # Threshold = 6 hours
    status = evaluate_freshness(recent_ts, threshold_hours=6, now=now)
    assert status == FreshnessStatus.FRESH


def test_evaluate_freshness_exactly_at_threshold():
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)
    exact_ts = now - timedelta(hours=6)
    status = evaluate_freshness(exact_ts, threshold_hours=6, now=now)
    assert status == FreshnessStatus.FRESH


def test_evaluate_freshness_outside_threshold():
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)
    old_ts = now - timedelta(hours=6, seconds=1)
    status = evaluate_freshness(old_ts, threshold_hours=6, now=now)
    assert status == FreshnessStatus.STALE


def test_evaluate_freshness_none_timestamp():
    status = evaluate_freshness(None, threshold_hours=6)
    assert status == FreshnessStatus.UNKNOWN


def test_evaluate_freshness_slight_clock_skew_future():
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)
    future_ts = now + timedelta(minutes=5)
    status = evaluate_freshness(future_ts, threshold_hours=6, now=now)
    assert status == FreshnessStatus.FRESH


def test_evaluate_freshness_naive_timestamp_assumed_utc():
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)
    naive_ts = datetime(2026, 10, 16, 10, 0, 0)  # 2 hours before now
    status = evaluate_freshness(naive_ts, threshold_hours=6, now=now)
    assert status == FreshnessStatus.FRESH


def test_provider_reliability_tracker_attempt_and_failure_isolation():
    tracker = ProviderReliabilityTracker()
    now = datetime(2026, 10, 16, 10, 0, 0, tzinfo=UTC)

    # 1. Start attempt for open-meteo
    tracker.record_attempt_start("open-meteo-marine")
    rec_marine = tracker.get_record("open-meteo-marine")
    assert rec_marine.last_attempt_utc is not None

    # 2. Record success
    tracker.record_attempt_success(
        provider="open-meteo-marine",
        message="Synced 72 points",
        sync_time=now,
        retrieved_count=72,
    )
    assert rec_marine.last_attempt_status == SyncOutcome.SUCCESS
    assert rec_marine.last_successful_sync_utc == now
    assert rec_marine.consecutive_failures == 0
    assert rec_marine.last_retrieved_count == 72

    # 3. Subsequent failure must preserve last_successful_sync_utc
    fail_time = now + timedelta(hours=1)
    tracker.record_attempt_failure(
        provider="open-meteo-marine",
        error_message="Connection timed out to open-meteo",
        category="timeout",
        attempt_time=fail_time,
    )
    assert rec_marine.last_attempt_status == SyncOutcome.FAILED
    assert rec_marine.consecutive_failures == 1
    # Preserved!
    assert rec_marine.last_successful_sync_utc == now
    assert rec_marine.last_attempt_message == "Connection timed out to open-meteo"
    assert rec_marine.last_error_category == "timeout"

    # 4. Failure on open-meteo must NOT affect gdacs or nhc
    rec_gdacs = tracker.get_record("gdacs")
    assert rec_gdacs.consecutive_failures == 0
    assert rec_gdacs.last_attempt_status == SyncOutcome.IDLE

    # 5. Second consecutive failure
    tracker.record_attempt_failure(
        provider="open-meteo-marine",
        error_message="HTTP 502 Bad Gateway",
        category="http_5xx",
    )
    assert rec_marine.consecutive_failures == 2

    # 6. Recovery restores consecutive_failures to 0
    recovery_time = fail_time + timedelta(hours=1)
    tracker.record_attempt_success(
        provider="open-meteo-marine",
        message="Synced 72 points on recovery",
        sync_time=recovery_time,
        retrieved_count=72,
    )
    assert rec_marine.consecutive_failures == 0
    assert rec_marine.last_successful_sync_utc == recovery_time
    assert rec_marine.last_attempt_status == SyncOutcome.SUCCESS


@pytest.mark.asyncio
async def test_provider_reliability_locks_independent():
    tracker = ProviderReliabilityTracker()
    lock_gdacs = tracker.get_lock("gdacs")
    lock_meteo = tracker.get_lock("open-meteo-marine")
    lock_nhc = tracker.get_lock("noaa-nhc")

    assert lock_gdacs is not lock_meteo
    assert lock_meteo is not lock_nhc
    assert lock_gdacs is not lock_nhc

    # Ensure re-fetching returns the exact same lock
    assert tracker.get_lock("GDACS") is lock_gdacs


def test_forecast_valid_time_vs_retrieval_time_semantics():
    """Verify that retrieval time (sync freshness) and forecast valid time (temporal validity) are distinct concepts."""
    now = datetime(2026, 10, 16, 12, 0, 0, tzinfo=UTC)

    # Scenario A: Forecast fetched 30 minutes ago (retrieval is fresh), but valid for yesterday (expired forecast)
    recent_retrieval = now - timedelta(minutes=30)
    expired_valid_time = now - timedelta(hours=24)

    retrieval_freshness = evaluate_freshness(
        recent_retrieval, threshold_hours=6, now=now
    )
    valid_time_freshness = evaluate_freshness(
        expired_valid_time, threshold_hours=6, now=now
    )

    # Retrieval itself is fresh
    assert retrieval_freshness == FreshnessStatus.FRESH
    # The valid time point is expired/stale relative to the current wall-clock
    assert valid_time_freshness == FreshnessStatus.STALE

    # Scenario B: Missing retrieval timestamp results in UNKNOWN, never fabricated
    assert (
        evaluate_freshness(None, threshold_hours=6, now=now) == FreshnessStatus.UNKNOWN
    )
