"""Private ID-free season-membership histogram gate; no DB or source import."""
from copy import deepcopy
from hashlib import sha256
from json import dumps, loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_membership_signature_audit import (
    LIMITATIONS,
    PROTOCOL,
    audit_membership_histogram,
)

ROOT = Path(__file__).resolve().parents[2] / "docs"


@pytest.fixture(scope="module")
def evidence():
    return tuple(loads((ROOT / path).read_text(encoding="utf-8")) for path in (
        "M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json",
        "M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json",
        "M3_SEVEN_SEASON_MEMBERSHIP_SIGNATURE_EVIDENCE.json",
    ))


def test_exact_public_and_private_membership_histograms_agree_but_not_identities(evidence):
    result = audit_membership_histogram(*evidence)
    assert result.protocol == PROTOCOL
    assert result.public_clubs == result.private_clubs == 26
    assert result.matching_histogram_groups == 16
    assert result.singleton_profile_clubs == 12
    assert result.ambiguous_profile_clubs == 14
    assert result.all_seven_season_clubs == 8
    assert result.aggregate_histogram_sha256 == (
        "281046ee181a3a404de4860125ce98c974a43c9e0aa20e0e66115279a0768add"
    )
    assert not result.private_identifiers_exported
    assert not result.verified_club_identity_mapping
    assert not result.played_goals_verified
    assert not result.real_training_authorized
    assert not result.holdout_2025_26_read


def test_same_26_and_82_not_enough_when_membership_profiles_differ(evidence):
    public, sample, observed = deepcopy(evidence)
    # Transfer one one-season club from earliest to latest season. This keeps
    # 26 clubs, 112 club-season appearances, and all 82 adjacent overlaps.
    first, last = observed["privateReadOnlyHistogram"][0], None
    last = next(row for row in observed["privateReadOnlyHistogram"] if row["mask"] == 64)
    first["clubCount"] -= 1
    last["clubCount"] += 1
    assert sum(x["clubCount"] for x in observed["privateReadOnlyHistogram"]) == 26
    assert sum(x["mask"].bit_count() * x["clubCount"]
               for x in observed["privateReadOnlyHistogram"]) == 112
    assert sum(x["clubCount"] for x in observed["privateReadOnlyHistogram"]
               for i in range(6)
               if x["mask"] & (1 << i) and x["mask"] & (1 << (i + 1))) == 82
    pairs = [[x["mask"], x["clubCount"]] for x in observed["privateReadOnlyHistogram"]]
    observed["aggregateHistogramSha256"] = sha256(
        dumps(pairs, separators=(",", ":")).encode()
    ).hexdigest()
    with pytest.raises(DataError, match="histograms differ"):
        audit_membership_histogram(public, sample, observed)


@pytest.mark.parametrize(("path", "replacement"), [
    (("scope",), "TRAINING"),
    (("observedOn",), "2025-11-09"),
    (("postgresMajor",), True),
    (("seasonsLeastToMostSignificant", 6), "2025/26"),
    (("privateReadOnlyHistogram", 0, "mask"), 0),
    (("privateReadOnlyHistogram", 0, "clubCount"), True),
    (("privateReadOnlyHistogram", 1, "mask"), 1),
    (("privateReadOnlyHistogram", 0, "clubCount"), 99),
    (("aggregateHistogramSha256",), "0" * 64),
    (("aggregate", "privateProviderClubCount"), 27),
    (("aggregate", "singletonProfileClubs"), 13),
    (("sourceTables", 0), "public.match_results"),
])
def test_private_aggregate_corruption_denied(evidence, path, replacement):
    public, sample, observed = deepcopy(evidence)
    node = observed
    for segment in path[:-1]:
        node = node[segment]
    node[path[-1]] = replacement
    with pytest.raises(DataError, match="M3 membership histogram:"):
        audit_membership_histogram(public, sample, observed)


@pytest.mark.parametrize("key", LIMITATIONS)
def test_each_private_disclosure_training_or_holdout_claim_denied(evidence, key):
    public, sample, observed = deepcopy(evidence)
    observed["limitations"][key] = True
    with pytest.raises(DataError, match="M3 membership histogram:"):
        audit_membership_histogram(public, sample, observed)


def test_extra_fields_raw_ids_and_missing_groups_are_denied(evidence):
    public, sample, observed = deepcopy(evidence)
    observed["providerIds"] = ["sensitive"]
    with pytest.raises(DataError, match="unexpected evidence fields"):
        audit_membership_histogram(public, sample, observed)

    public, sample, observed = deepcopy(evidence)
    observed["privateReadOnlyHistogram"] = observed["privateReadOnlyHistogram"][:-1]
    with pytest.raises(DataError, match="M3 membership histogram:"):
        audit_membership_histogram(public, sample, observed)


def test_public_alias_mutation_and_sample_overclaim_refused(evidence):
    public, sample, observed = deepcopy(evidence)
    public["seasonReferences"][0]["publicNameAliasesInFinalTableOrder"][0] = "unknown"
    with pytest.raises(DataError):
        audit_membership_histogram(public, sample, observed)
    public, sample, observed = deepcopy(evidence)
    sample["limitations"]["independentClubIdentityMappingAccepted"] = True
    with pytest.raises(DataError):
        audit_membership_histogram(public, sample, observed)
