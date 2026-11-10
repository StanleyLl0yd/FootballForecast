"""Negative and positive M3-A3 nine-event private-safe official schedule checks."""
from copy import deepcopy
from json import loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_nine_official_minutes import (
    NEGATIVE_GATES,
    audit_nine_official_minutes,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


@pytest.fixture
def evidence():
    return tuple(loads((DOCS / name).read_text(encoding="utf-8")) for name in (
        "M3_NINE_OFFICIAL_UTC_MINUTE_EVIDENCE.json",
        "M3_OFFICIAL_SCHEDULED_UTC_EVIDENCE.json",
        "M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json",
    ))


def test_nine_exact_minute_candidates_are_not_real_training_eligibility(evidence):
    result = audit_nine_official_minutes(*evidence)
    assert result.matched_events == 9
    assert result.distinct_anonymous_opponents == 8
    assert result.certified_private_club_links == result.eligible_played_rows == 0
    assert not result.real_training_authorized
    assert not result.holdout_read
    observed = evidence[0]
    assert observed["anonymousGraph"]["distinctMask127OpponentIds"] == 3
    assert sum(x["exactUtcMinuteCount"] for x in observed["events"]) == 9
    assert observed["events"][4]["earlyPublicScheduleConflict"] is True


@pytest.mark.parametrize(("i", "field", "bad"), [
    (0, "homeAlias", "sochi"),
    (1, "awayMask", 127),
    (2, "scheduledUtc", "2023-10-01T12:00:00Z"),
    (3, "scheduledLocalMoscow", "2023-10-07T15:00:00"),
    (4, "scheduledLocalMoscow", "2023-10-22T14:00:00"),
    (4, "earlyPublicScheduleConflict", False),
    (5, "homeMask", 127),
    (6, "privateDayMatches", 4),
    (7, "exactUtcMinuteCount", 0),
    (8, "withinHourCount", 0),
    (0, "season", "2025/26"),
    (3, "privateDayMatches", True),
])
def test_mutated_source_match_or_revision_rejected(evidence, i, field, bad):
    cur, old, calendar = deepcopy(evidence)
    cur["events"][i][field] = bad
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)


@pytest.mark.parametrize("key", NEGATIVE_GATES)
def test_each_false_approval_disclosure_or_holdout_flag_rejected(evidence, key):
    cur, old, calendar = deepcopy(evidence)
    cur["limitations"][key] = True
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)


@pytest.mark.parametrize(("field", "bad"), [
    ("exactMinuteCandidateRows", 8),
    ("eventsCovered", 10),
    ("sochiAnonymousIds", 2),
    ("distinctOpponentIds", 7),
    ("distinctMask127OpponentIds", 4),
    ("reciprocalSpartakCandidateIds", 2),
    ("singletonOpponentIds", 6),
    ("certifiedPrivateClubLinks", 1),
    ("eligiblePlayedRows", 9),
])
def test_anonymous_graph_count_or_eligibility_overclaim_rejected(evidence, field, bad):
    cur, old, calendar = deepcopy(evidence)
    cur["anonymousGraph"][field] = bad
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)


def test_duplicate_private_id_or_unsupported_source_rejected(evidence):
    cur, old, calendar = deepcopy(evidence)
    cur["events"][0]["privateId"] = "forbidden"
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)

    cur, old, calendar = deepcopy(evidence)
    cur["events"][1] = cur["events"][0].copy()
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)

    cur, old, calendar = deepcopy(evidence)
    cur["sourceDocuments"]["rfsCalendar"] = "https://example.com/"
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)


def test_existing_two_event_evidence_is_not_silently_weakened(evidence):
    cur, old, calendar = deepcopy(evidence)
    old["events"][0]["exactUtcMinuteCount"] = 0
    with pytest.raises(DataError):
        audit_nine_official_minutes(cur, old, calendar)
