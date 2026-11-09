"""Fail-closed regression checks for M3 official local-to-UTC observations."""
from copy import deepcopy
from json import loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_official_scheduled_minute import (
    audit_official_scheduled_minute,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


@pytest.fixture
def receipts():
    return (
        loads((DOCS / "M3_OFFICIAL_SCHEDULED_UTC_EVIDENCE.json").read_text(encoding="utf-8")),
        loads((DOCS / "M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json").read_text(
            encoding="utf-8"
        )),
    )


def test_two_official_scheduled_minutes_match_without_authorizing_fitting(receipts):
    result = audit_official_scheduled_minute(*receipts)
    assert result.exact_minute_candidates == 2
    assert result.certified_private_team_links == 0
    assert result.eligible_played_rows == 0
    assert not result.actual_kickoff_verified
    assert not result.historical_first_serving_verified
    assert not result.real_training_authorized
    assert not result.holdout_read


@pytest.mark.parametrize(("field", "replacement"), [
    ("scheduledUtc", "2023-09-16T17:00:00Z"),
    ("scheduledLocalMoscow", "2023-09-16T20:00:00"),
    ("articleDate", "2023-09-16"),
    ("articleUrl", "https://example.com/unsupported"),
    ("homeAlias", "sochi"), ("awayMask", 127),
    ("homeMask", 62), ("season", "2025/26"),
    ("privateDayMatches", 3), ("privateMaskDirectionCount", 2),
    ("exactUtcMinuteCount", 0), ("exactUtcMinuteCount", 2),
    ("withinHourCount", 0), ("privateDayMatches", True),
])
def test_mutated_time_direction_count_or_source_is_rejected(receipts, field, replacement):
    a, b = deepcopy(receipts)
    a["events"][0][field] = replacement
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)


@pytest.mark.parametrize("flag", [
    "privateIdsExported", "privateRowsExported", "scoreFieldsRead",
    "privateSpartakIdVerified", "actualKickoffVerified",
    "originalFirstServingUtcVerified", "playedGoalStatusVerified",
    "sourceTrainingRightsVerified", "realTrainingAuthorized",
    "holdout2025_26Read", "publicPredictionsWritten",
])
def test_disclosure_and_forged_approvals_are_blocked(receipts, flag):
    a, b = deepcopy(receipts)
    a["limitations"][flag] = True
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)


def test_prior_calendar_count_conflict_is_rejected(receipts):
    a, b = deepcopy(receipts)
    for row in b["events"]:
        if row["eventKey"] == "sochi_spartak_a":
            row["privateMatchesOnSameUtcDay"] = 5
    with pytest.raises(DataError, match="contradicts"):
        audit_official_scheduled_minute(a, b)


def test_extra_private_id_duplicate_or_absent_event_is_rejected(receipts):
    a, b = deepcopy(receipts)
    a["events"][0]["privateId"] = "must-not-export"
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)
    a, b = deepcopy(receipts)
    a["events"][1] = a["events"][0]
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)
    a, b = deepcopy(receipts)
    a["events"].pop()
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)


def test_aggregate_cannot_claim_training_eligibility(receipts):
    a, b = deepcopy(receipts)
    a["aggregate"]["eligiblePlayedRows"] = 2
    with pytest.raises(DataError):
        audit_official_scheduled_minute(a, b)
