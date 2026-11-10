"""M3-A3 public anchor graph: exactly six anonymous fixtures, no real eligibility."""
from copy import deepcopy
from json import loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_mask127_anchor_graph import (
    DENIALS,
    audit_mask127_anchor_graph,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


@pytest.fixture
def evidence():
    return tuple(loads((DOCS / name).read_text(encoding="utf-8")) for name in (
        "M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_EVIDENCE.json",
        "M3_NINE_OFFICIAL_UTC_MINUTE_EVIDENCE.json",
    ))


def test_aggregate_links_do_not_approve_real_club_mapping_or_training(evidence):
    report = audit_mask127_anchor_graph(*evidence)
    assert report.unique_official_fixture_candidates == 6
    assert report.uniquely_linked_public_aliases == 3
    assert report.distinct_anonymous_sochi_ids == 1
    assert report.independently_eligible_private_rows == 0
    assert not report.named_private_club_crosswalk_certified
    assert not report.real_training_authorized
    assert not report.holdout_read


@pytest.mark.parametrize(("i", "key", "bad"), [
    (0, "homeAlias", "zenit"),
    (1, "awayMask", 111),
    (2, "scheduledUtc", "2023-10-07T12:00:00Z"),
    (3, "scheduledLocalMoscow", "2023-09-17T15:30:00"),
    (4, "privateMaskDirectionCount", 0),
    (5, "exactUtcMinuteCount", 2),
    (0, "privateDayMatches", True),
    (3, "priorNineEventCode", "sochi_spartak_b"),
    (4, "season", "2025/26"),
    (5, "publicClubAlias", "zenit"),
])
def test_modified_public_event_or_anonymous_count_rejected(evidence, i, key, bad):
    a, p = deepcopy(evidence)
    a["events"][i][key] = bad
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)


@pytest.mark.parametrize("flag", DENIALS)
def test_all_twelve_privacy_status_holdout_gates_fail_closed(evidence, flag):
    a, p = deepcopy(evidence)
    a["limitations"][flag] = True
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)


@pytest.mark.parametrize(("field", "bad"), [
    ("exactCandidateRows", 5),
    ("nonuniqueEvents", 1),
    ("uniquelyLinkedPublicClubAliases", 2),
    ("distinctAnonymousClubIds", 1),
    ("distinctAnonymousSochiIds", 2),
    ("certifiedPrivateClubIdMappings", 3),
    ("certifiedPlayedPrivateRows", 6),
    ("eventsCovered", True),
])
def test_anonymous_graph_is_not_private_club_certification(evidence, field, bad):
    a, p = deepcopy(evidence)
    a["anonymousGraph"][field] = bad
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)


def test_prior_nine_minute_fixture_must_agree(evidence):
    a, p = deepcopy(evidence)
    p["events"][3]["scheduledUtc"] = "2023-10-07T12:00:00Z"
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)


def test_no_private_identifiers_goals_or_extra_fields(evidence):
    a, p = deepcopy(evidence)
    a["events"][0]["providerTeamId"] = "private"
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)
    a, p = deepcopy(evidence)
    a["events"][0]["homeGoals"] = 1
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)
    a, p = deepcopy(evidence)
    a["anonymousGraph"]["providerIds"] = [123]
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)


def test_source_cannot_be_replaced_by_arbitrary_url(evidence):
    a, p = deepcopy(evidence)
    a["sourceRfsCalendar"] = "https://example.org/"
    with pytest.raises(DataError):
        audit_mask127_anchor_graph(a, p)
