"""Fail-closed, synthetic-only structural gate for historical RPL forecast weather.

A passing receipt is NOT independent proof of provider publication/rights and
never authorizes attaching weather to any research model or to the M2 lock.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import isfinite

from football_forecast.data.contracts import DataError

DEVELOPMENT_SEASONS = frozenset(f"{y}/{(y + 1) % 100:02d}" for y in range(2018, 2025))
CANDIDATE_ONLY = "RESEARCH_CANDIDATE_REQUIRES_INDEPENDENT_REVIEW"


@dataclass(frozen=True, slots=True)
class WeatherCandidate:
    season: str
    kickoff_at: datetime
    forecast_valid_at: datetime
    forecast_run_at: datetime | None
    first_available_at: datetime | None
    venue_valid_from: datetime | None
    venue_valid_until: datetime | None
    venue_latitude: float | None
    venue_longitude: float | None
    venue_independent_evidence: bool = False
    run_independent_evidence: bool = False
    availability_independent_evidence: bool = False
    rights_independent_evidence: bool = False


@dataclass(frozen=True, slots=True)
class WeatherCandidateReceipt:
    cutoff_at: datetime
    status: str = CANDIDATE_ONLY
    approved_as_historical_prematch_feature: bool = False
    approved_for_model_training: bool = False
    independent_source_verification_completed_by_this_function: bool = False


def _utc(value: object) -> bool:
    return (isinstance(value, datetime) and value.tzinfo is not None
            and value.utcoffset() == timedelta(0))


def check_weather_candidate(candidate: WeatherCandidate) -> WeatherCandidateReceipt:
    """Reject timing/location/provenance gaps; never produce an approved feature.

    The evidence booleans are explicit assertions from a separate human/source
    review, not authentication performed here. Missing evidence fails closed.
    Never infer issuance or serving time from a `_previous_day1` value alone.
    """
    if not isinstance(candidate, WeatherCandidate) or candidate.season not in DEVELOPMENT_SEASONS:
        raise DataError("RPL weather: only 2018/19–2024/25 development research is eligible")
    values = (
        candidate.kickoff_at, candidate.forecast_valid_at, candidate.forecast_run_at,
        candidate.first_available_at, candidate.venue_valid_from,
        candidate.venue_valid_until,
    )
    if not all(_utc(value) for value in values):
        raise DataError("RPL weather: independently evidenced explicit UTC timestamps required")
    kickoff, valid, run, available, venue_from, venue_until = values
    year = int(candidate.season[:4])
    season_start = datetime(year, 7, 1, tzinfo=UTC)
    season_end = datetime(2020, 8, 1, tzinfo=UTC) if year == 2019 else datetime(year + 1, 7, 1, tzinfo=UTC)
    if not season_start <= kickoff < season_end:
        raise DataError("RPL weather: kickoff outside development season")
    cutoff = datetime(kickoff.year, kickoff.month, kickoff.day, tzinfo=UTC)
    if not (timedelta(0) <= kickoff - valid < timedelta(hours=1)):
        raise DataError("RPL weather: future or nonmatching forecast valid hour")
    if not (valid - run >= timedelta(hours=24) and run <= available <= cutoff):
        raise DataError("RPL weather: run or original source availability after cutoff")
    if not venue_from <= kickoff < venue_until:
        raise DataError("RPL weather: historical venue validity interval does not cover kickoff")
    lat, lon = candidate.venue_latitude, candidate.venue_longitude
    if (type(lat) not in (float, int) or type(lon) not in (float, int)
            or not isfinite(lat) or not isfinite(lon)
            or not -90 <= lat <= 90 or not -180 <= lon <= 180):
        raise DataError("RPL weather: historically verified venue coordinates required")
    evidence = (
        candidate.venue_independent_evidence, candidate.run_independent_evidence,
        candidate.availability_independent_evidence, candidate.rights_independent_evidence,
    )
    if any(flag is not True for flag in evidence):
        raise DataError("RPL weather: independently reviewed venue/run/availability/rights evidence missing")
    return WeatherCandidateReceipt(cutoff_at=cutoff)
