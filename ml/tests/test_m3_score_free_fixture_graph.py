"""Fail-closed audit for a purely structural 5-season fixture graph receipt."""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_score_free_fixture_graph import (
    audit_score_free_fixture_graph,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


def _data():
    def load(path: str):
        return json.loads((DOCS / path).read_text(encoding="utf-8"))

    return (
        load("M3_SCORE_FREE_FIXTURE_GRAPH_EVIDENCE.json"),
        load("M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_EVIDENCE.json"),
        load("M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json"),
    )


def test_scoped_graph_is_consistent_without_certifying_any_played_rows():
    report = audit_score_free_fixture_graph(*_data())
    assert report.no_score_seed_matches == 1063
    assert report.consistency_resolved_matches == 1200
    assert report.score_disagreements_after_resolution == 0
    assert report.independently_certified_training_rows == 0
    assert report.real_training_authorized is False


@pytest.mark.parametrize(
    ("section", "key", "value"),
    [
        ("root", "schemaVersion", True),
        ("root", "kind", "LIVE"),
        ("root", "sourceInventory", "WRONG"),
        ("root", "scope", "2025/26"),
        ("root", "method", "GOAL_BASED_TEAM_IDENTITY"),
        ("graphTotals", "initialReciprocalSeedSingletons", 1200),
        ("graphTotals", "initialAmbiguousPublicFixtures", 0),
        ("graphTotals", "postConsistencyResolvedPublicFixtures", 1199),
        ("graphTotals", "postLinkScoreDisagreements", 1),
        ("graphTotals", "distinctPublicAliasesObserved", 26),
        ("graphTotals", "internalPublicAliasesHavingMultipleProviderIds", 1),
        ("graphTotals", "independentlyCertifiedEligiblePrivateRows", 1200),
        ("gateStatus", "m3AcceptedCriteria", 3),
        ("gateStatus", "m3A3Accepted", True),
        ("gateStatus", "holdout2025_26Read", True),
        ("limitations", "privateIdsExported", True),
        ("limitations", "privateRowsExported", True),
        ("limitations", "playedVsAwardedGoalStatusVerified", True),
        ("limitations", "sourceTrainingRightsVerified", True),
        ("limitations", "allSevenSeasonsCovered", True),
        ("limitations", "realModelFitted", True),
        ("limitations", "supabaseTablesMutated", True),
        ("limitations", "productionModelChanged", True),
    ],
)
def test_scope_and_confidence_escalations_are_rejected(section, key, value):
    current, prior, roster = _data()
    broken = deepcopy(current)
    if section == "root":
        broken[key] = value
    else:
        broken[section][key] = value
    with pytest.raises(DataError, match="M3 score-free fixture graph"):
        audit_score_free_fixture_graph(broken, prior, roster)


@pytest.mark.parametrize("idx", [0, 1, 2, 3, 4])
def test_each_season_and_public_source_pin_is_immutable(idx):
    current, prior, roster = _data()
    current["seasons"][idx]["reciprocalSeedSingletons"] += 1
    with pytest.raises(DataError):
        audit_score_free_fixture_graph(current, prior, roster)
    current, prior, roster = _data()
    current["sourceFiles"][idx]["blobSha"] = "0" * 40
    with pytest.raises(DataError):
        audit_score_free_fixture_graph(current, prior, roster)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("publicRecordsCorrectedInMemory", 2),
        ("sourceFileLine", 112),
        ("privateArchiveModified", True),
        ("originalRfsKickoffUtcAttested", True),
        ("archivedPublicHome", "Spartak Moskva"),
    ],
)
def test_public_correction_must_remain_one_hypothesis(field, value):
    current, prior, roster = _data()
    current["public2023_24OneFixtureDirectionCorrection"][field] = value
    with pytest.raises(DataError):
        audit_score_free_fixture_graph(current, prior, roster)


def test_no_extra_private_fields_or_prior_provenance_mutation():
    current, prior, roster = _data()
    current["seasons"][0]["privateProviderId"] = "must_not_leak"
    with pytest.raises(DataError):
        audit_score_free_fixture_graph(current, prior, roster)
    current, prior, roster = _data()
    prior["seasons"][2]["publicGitBlobSha"] = "f" * 40
    with pytest.raises(DataError):
        audit_score_free_fixture_graph(current, prior, roster)
