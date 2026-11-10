"""No-live-input guards for the RFS official score-shape receipt."""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_official_score_correspondence import (
    audit_official_score_correspondence,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


def _receipts():
    current = json.loads(
        (DOCS / "M3_SIX_OFFICIAL_SCORE_SHAPE_EVIDENCE.json").read_text(encoding="utf-8")
    )
    older = json.loads(
        (DOCS / "M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_EVIDENCE.json").read_text(
            encoding="utf-8"
        )
    )
    return current, older


def test_pinned_public_scores_match_anonymous_receipt_without_certification():
    receipt, previous = _receipts()
    audit = audit_official_score_correspondence(receipt, previous)
    assert audit.official_result_shape_agreements == 6
    assert audit.independent_played_goal_labels == 0
    assert audit.certified_eligible_private_rows == 0
    assert not audit.private_rows_exported
    assert not audit.real_training_authorized


@pytest.mark.parametrize(
    ("section", "key", "alteration"),
    [
        ("root", "schemaVersion", True),
        ("root", "kind", "SOME_OTHER_KIND"),
        ("root", "scope", "LIVE"),
        ("root", "observedOn", "2025-11-10"),
        ("root", "retrospectiveOfficialCalendarUrl", "https://invalid.example"),
        ("root", "originalRfsNoticeTimestampIntegrity", "VERIFIED"),
        ("aggregatePrivateSelect", "officialScoreAgreements", 5),
        ("aggregatePrivateSelect", "officialScoreDisagreements", 1),
        ("aggregatePrivateSelect", "anonymousExactMinuteMatches", 7),
        ("aggregatePrivateSelect", "certifiedEligiblePrivateRows", 6),
        ("limitations", "privateIdsExported", True),
        ("limitations", "privateScoreValuesExported", True),
        ("limitations", "playedGoalStatusIndependentlyVerified", True),
        ("limitations", "realM3TrainingAuthorized", True),
        ("limitations", "holdout2025_26Read", True),
    ],
)
def test_receipt_is_fail_closed(section, key, alteration):
    current, prior = _receipts()
    bad = deepcopy(current)
    if section == "root":
        bad[key] = alteration
    else:
        bad[section][key] = alteration
    with pytest.raises(DataError, match="M3 six official scores"):
        audit_official_score_correspondence(bad, prior)


@pytest.mark.parametrize(
    ("index", "field", "value"),
    [
        (0, "homeOfficialGoals", 2),
        (1, "awayOfficialGoals", 1),
        (2, "displayedNoticeDate", "2023-10-08"),
        (3, "preMatchNoticeUrl", "https://invalid.example"),
        (4, "eventCode", "invented-event"),
        (5, "privateScoreShapeAgreementCount", 0),
        (0, "homeOfficialGoals", True),
    ],
)
def test_event_edit_rejected(index, field, value):
    current, prior = _receipts()
    current["events"][index][field] = value
    with pytest.raises(DataError, match="M3 six official scores"):
        audit_official_score_correspondence(current, prior)


@pytest.mark.parametrize("field", [
    "privateIdsExported", "privateRowsExported", "eligiblePrivateRowsCertified",
    "realTrainingAuthorized", "holdout2025_26Read",
])
def test_prior_anchor_denial_must_remain_false(field):
    current, prior = _receipts()
    prior["limitations"][field] = True
    with pytest.raises(DataError, match="M3 six official scores"):
        audit_official_score_correspondence(current, prior)


def test_no_missing_or_extra_events_or_fields():
    current, previous = _receipts()
    current["events"] = current["events"][:-1]
    with pytest.raises(DataError):
        audit_official_score_correspondence(current, previous)
    current, previous = _receipts()
    current["unsafe_extra_data"] = "private_id"
    with pytest.raises(DataError):
        audit_official_score_correspondence(current, previous)
    current, previous = _receipts()
    current["events"][0]["private_team_id"] = "blocked"
    with pytest.raises(DataError):
        audit_official_score_correspondence(current, previous)
