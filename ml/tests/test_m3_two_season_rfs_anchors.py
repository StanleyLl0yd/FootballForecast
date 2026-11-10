"""Public RFS six-anchor evidence: protected no-training/ID contract."""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_two_season_rfs_anchors import (
    audit_two_season_rfs_anchors,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


def _receipts():
    def read(path):
        return json.loads((DOCS / path).read_text(encoding="utf-8"))

    return (
        read("M3_TWO_SEASON_SIX_RFS_ANCHORS_EVIDENCE.json"),
        read("M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json"),
    )


def test_six_first_party_anchors_do_not_certify_official_played_goals():
    a = audit_two_season_rfs_anchors(*_receipts())
    assert a.official_retrospective_anchor_matches == 6
    assert a.distinct_anchor_seasons == 2
    assert a.contaminated_official_result_examples == 1
    assert a.eligible_private_rows_certified == 0
    assert not a.private_ids_exported
    assert not a.real_training_authorized


@pytest.mark.parametrize(
    ("section", "key", "value"),
    [
        ("root", "schemaVersion", True),
        ("root", "kind", "FAKE"),
        ("root", "scope", "HOLDOUT_2025_26"),
        ("root", "calendarKind", "ORIGINAL_SERVING_PROVEN"),
        ("summary", "events", 7),
        ("summary", "exactUtcMinuteCandidates", 5),
        ("summary", "officialScoreAgreements", 5),
        ("summary", "independentlyCertifiedPrivatePlayedRows", 6),
        ("limitations", "allSeasonFixturesReviewed", True),
        ("limitations", "privateMatchIdsExported", True),
        ("limitations", "privateTeamIdsExported", True),
        ("limitations", "privatePerMatchScoresExported", True),
        ("limitations", "originalKickoffUtcIndependentlyAuthenticated", True),
        ("limitations", "sourceFirstServingUtcVerified", True),
        ("limitations", "sourceTrainingRightsVerified", True),
        ("limitations", "full2021_22Or2022_23DatasetValidated", True),
        ("limitations", "holdout2025_26Read", True),
        ("limitations", "m3A3Accepted", True),
        ("limitations", "productionModelChanged", True),
    ],
)
def test_fail_closed_metadata(section, key, value):
    record, roster = _receipts()
    broken = deepcopy(record)
    if section == "root":
        broken[key] = value
    else:
        broken[section][key] = value
    with pytest.raises(DataError, match="M3 two-season RFS anchors"):
        audit_two_season_rfs_anchors(broken, roster)


@pytest.mark.parametrize("index", [0, 1, 2, 3, 4, 5])
def test_public_anchors_have_exact_time_score_masks(index):
    record, roster = _receipts()
    record["events"][index]["exactMinuteCandidates"] = 2
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)
    record, roster = _receipts()
    record["events"][index]["scheduledUtcFromMoscow"] = "2025-07-24T14:30:00Z"
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)
    record, roster = _receipts()
    record["events"][index]["homeMask"] = 127
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)


@pytest.mark.parametrize(
    ("section", "key", "value"),
    [
        ("administrativeResultWarning", "onFieldHomeGoals", 0),
        ("administrativeResultWarning", "onFieldAwayGoals", 3),
        ("administrativeResultWarning", "privateRowCertifiedPlayedScore", True),
        ("crossEventIdEqualityAnonymous", "privateIdsExported", True),
    ],
)
def test_technical_revision_or_public_id_denial_kept(section, key, value):
    record, roster = _receipts()
    record[section][key] = value
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)


def test_previous_public_roster_mutation_is_refused():
    record, roster = _receipts()
    roster["seasonReferences"][4]["publicNameAliasesInFinalTableOrder"].remove(
        "torpedo"
    )
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)


def test_arbitrary_new_private_fields_are_not_accepted():
    record, roster = _receipts()
    record["events"][0]["opaque_private_match_id"] = "NO"
    with pytest.raises(DataError):
        audit_two_season_rfs_anchors(record, roster)
