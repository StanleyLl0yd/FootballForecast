"""Synthetic-only weather temporal and source gate regression tests."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_weather_candidate import (
    CANDIDATE_ONLY,
    WeatherCandidate,
    check_weather_candidate,
)


def candidate(**changes):
    # 18:30 UTC fixture, 18:00 UTC forecast-valid hour, previous-day 12Z run;
    # upstream availability must be proven independently, not assumed from run.
    base = WeatherCandidate(
        season="2024/25",
        kickoff_at=datetime(2024, 8, 1, 18, 30, tzinfo=UTC),
        forecast_valid_at=datetime(2024, 8, 1, 18, tzinfo=UTC),
        forecast_run_at=datetime(2024, 7, 31, 12, tzinfo=UTC),
        first_available_at=datetime(2024, 7, 31, 19, tzinfo=UTC),
        venue_valid_from=datetime(2020, 1, 1, tzinfo=UTC),
        venue_valid_until=datetime(2025, 1, 1, tzinfo=UTC),
        venue_latitude=59.93, venue_longitude=30.31,
        venue_independent_evidence=True,
        run_independent_evidence=True,
        availability_independent_evidence=True,
        rights_independent_evidence=True,
    )
    return replace(base, **changes)


def test_time_plausible_candidate_does_not_authorize_any_model_use():
    record = check_weather_candidate(candidate())
    assert record.cutoff_at == datetime(2024, 8, 1, tzinfo=UTC)
    assert record.status == CANDIDATE_ONLY
    assert record.approved_as_historical_prematch_feature is False
    assert record.approved_for_model_training is False
    assert record.independent_source_verification_completed_by_this_function is False


def test_exact_cutoff_inclusive_but_later_delivery_rejected():
    assert check_weather_candidate(candidate(first_available_at=datetime(2024, 8, 1, tzinfo=UTC)))
    with pytest.raises(DataError):
        check_weather_candidate(candidate(first_available_at=datetime(2024, 8, 1, 0, 1, tzinfo=UTC)))


@pytest.mark.parametrize('changes', [
    {'season': '2025/26'},
    {'season': '2026/27'},
    {'kickoff_at': datetime(2024, 6, 30, 18, 30, tzinfo=UTC)},
    {'forecast_valid_at': datetime(2024, 8, 1, 19, tzinfo=UTC)},
    {'forecast_valid_at': datetime(2024, 8, 1, 16, tzinfo=UTC)},
    {'forecast_run_at': None},
    {'forecast_run_at': datetime(2024, 7, 31, 23, tzinfo=UTC)},
    {'forecast_run_at': datetime(2024, 7, 31, 20, tzinfo=UTC)},
    {'first_available_at': None},
    {'first_available_at': datetime(2024, 7, 31, 11, tzinfo=UTC)},
    {'first_available_at': datetime(2024, 8, 1, 6, tzinfo=UTC)},
    {'venue_valid_from': None},
    {'venue_valid_until': datetime(2024, 7, 1, tzinfo=UTC)},
    {'venue_latitude': None},
    {'venue_latitude': float('nan')},
    {'venue_longitude': 181.0},
    {'venue_independent_evidence': False},
    {'run_independent_evidence': False},
    {'availability_independent_evidence': False},
    {'rights_independent_evidence': False},
    {'first_available_at': datetime(2024, 7, 31, 19)},
    {'first_available_at': datetime(2024, 7, 31, 19, tzinfo=timezone(timedelta(hours=3)))},
])
def test_missing_future_or_unproven_evidence_fails_closed(changes):
    with pytest.raises(DataError):
        check_weather_candidate(candidate(**changes))


def test_covid_extension_is_valid_and_end_of_season_excluded():
    a = candidate(
        season='2019/20',
        kickoff_at=datetime(2020, 7, 15, 17, 15, tzinfo=UTC),
        forecast_valid_at=datetime(2020, 7, 15, 17, tzinfo=UTC),
        forecast_run_at=datetime(2020, 7, 14, 11, tzinfo=UTC),
        first_available_at=datetime(2020, 7, 14, 18, tzinfo=UTC),
    )
    assert check_weather_candidate(a).approved_for_model_training is False
    with pytest.raises(DataError):
        check_weather_candidate(replace(a, kickoff_at=datetime(2020, 8, 1, 17, 15, tzinfo=UTC)))
