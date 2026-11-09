"""Synthetic-only cross-provider 2025/26 roster identities, no holdout reads."""
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.locking import _digest
from football_forecast.research.openfootball_crosswalk import (
    OFFICIAL_2025_FINAL_ROSTER,
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
    prepare_provider_independent_name_policy,
)

ALIASES = tuple(sorted(
    _train_alias(name)
    for name in TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL.values()
))


def policy():
    return prepare_provider_independent_name_policy(model_team_aliases=ALIASES)


def metadata():
    # Provider IDs are intentionally unrelated to any 2024 training supplier.
    return tuple(
        (f"newprovider:{i:03}", name)
        for i, name in enumerate(reversed(OFFICIAL_2025_FINAL_ROSTER))
    )


def test_independent_policy_uses_official_names_and_exact_frozen_model():
    p = policy()
    assert _digest(ALIASES) == (
        "3f10e2bd77f348b570036efc8827f0571a26cae55c7dcb4ad93b5a39710e631b"
    )
    assert p == policy()
    assert len(p.official_entries) == 16
    assert sum(alias.startswith("S_") for _, alias in p.official_entries) == 14
    assert sum(alias.startswith("U_") for _, alias in p.official_entries) == 2
    assert p.resolve_official_name("Зенит") == _train_alias("Zenit St. Petersburg")
    assert p.resolve_official_name("Балтика").startswith("U_")
    assert p.resolve_official_name("Сочи").startswith("U_")
    for rejected in ("Торпедо", "Зенит ", "zenit", "Химки", 42):
        with pytest.raises(DataError):
            p.resolve_official_name(rejected)
    assert p.public_receipt()["theoreticalEligibleMatches"] == 182
    assert p.public_receipt()["theoreticalAbstentions"] == 58
    assert p.public_receipt()["providerSourceBound"] is False
    assert p.public_receipt()["holdoutRead"] is False
    assert p.public_receipt()["immutableStudyLockApproved"] is False


def test_fully_different_2025_source_identifiers_bind_without_train_id_reuse():
    p = policy()
    b = p.prepare_provider_roster_candidate(
        source_namespace="new-independent-provider",
        roster_pairs=metadata(),
    )
    assert b == p.prepare_provider_roster_candidate(
        source_namespace="new-independent-provider",
        roster_pairs=tuple(reversed(metadata())),
    )
    assert len(b.entries) == 16
    assert len({provider_id for provider_id, _, _ in b.entries}) == 16
    assert len({alias for _, _, alias in b.entries}) == 16
    assert sum(alias.startswith("S_") for _, _, alias in b.entries) == 14
    assert sum(alias.startswith("U_") for _, _, alias in b.entries) == 2
    for provider_id, official, alias in b.entries:
        assert b.resolve_source_id(provider_id) == p.resolve_official_name(official)
        assert alias == p.resolve_official_name(official)
    receipt = b.public_receipt()
    assert receipt["policySha256"] == p.sha256
    assert receipt["providerRosterSha256"] == b.sha256
    assert receipt["sourceRightsApproved"] is False
    assert receipt["sourceRosterIndependentlyAuthenticated"] is False
    assert receipt["evaluationPermitted"] is False
    assert receipt["holdoutRead"] is False
    assert all(provider_id not in str(receipt) for provider_id, _ in metadata())
    assert "S_" not in str(receipt) and "U_" not in str(receipt)
    with pytest.raises(DataError):
        b.resolve_source_id("unlisted-provider:123")


def test_other_source_requires_another_frozen_roster_digest():
    p = policy()
    a = p.prepare_provider_roster_candidate(
        source_namespace="provider-one", roster_pairs=metadata(),
    )
    b = p.prepare_provider_roster_candidate(
        source_namespace="provider-two", roster_pairs=metadata(),
    )
    assert a.sha256 != b.sha256
    metadata_changed = (
        ("other-id:000", metadata()[0][1]),
        *metadata()[1:],
    )
    c = p.prepare_provider_roster_candidate(
        source_namespace="provider-one", roster_pairs=metadata_changed,
    )
    assert a.sha256 != c.sha256
    with pytest.raises((FrozenInstanceError, AttributeError, TypeError)):
        a.sha256 = "0" * 64


def test_missing_replaced_duplicate_and_mismatched_provider_rosters_are_refused():
    p = policy()
    rows = metadata()
    cases = (
        rows[:-1],
        (*rows[:-1], rows[0]),
        (*rows[:-1], ("newprovider:015", "Торпедо")),
        (*rows[:-1], ("newprovider:015", "Зенит ")),
        (*rows[:-1], ("newprovider:015", rows[0][1])),
        (*rows[:-1], (rows[0][0], rows[-1][1])),
        (*rows[:-1], ("invalid id", rows[-1][1])),
        (*rows[:-1], (123, rows[-1][1])),
        (*rows[:-1], ("newprovider:015", 123)),
    )
    for rows_invalid in cases:
        with pytest.raises(DataError):
            p.prepare_provider_roster_candidate(
                source_namespace="new-provider", roster_pairs=rows_invalid,
            )
    for invalid_name in ("https://example.com", "UPPER", "../escape", ""):
        with pytest.raises(DataError):
            p.prepare_provider_roster_candidate(
                source_namespace=invalid_name, roster_pairs=rows,
            )
    for wrong_aliases in (
        ALIASES[:-1],
        (*ALIASES[:-1], "S_" + "F" * 20),
        tuple(reversed(ALIASES[:-1])) + ("U_" + "F" * 20,),
    ):
        with pytest.raises(DataError):
            prepare_provider_independent_name_policy(model_team_aliases=wrong_aliases)


def test_2025_source_eligibility_review_is_metadata_only_and_fail_closed():
    review = json.loads(
        (Path(__file__).resolve().parents[2] /
         "docs/M2_2025_HOLDOUT_SOURCE_REVIEW.json").read_text(encoding="utf-8")
    )
    assert review["kind"] == "M2_2025_26_HOLDOUT_SOURCE_ELIGIBILITY_REVIEW"
    assert review["protocol"] == "m2-openfootball-calendar-v1"
    assert review["noResultsOr2025MatchRecordsInspectedForThisReview"] is True
    sources = {item["id"]: item for item in review["sources"]}
    assert len(sources) == 5
    assert sources["openfoot"]["status"] == "UNQUALIFIED_COMPETITION_SOURCE_UNLICENSED"
    assert sources["openfoot"]["catalogueSourceName"] == "FotMob"
    assert "Unlicensed" in sources["openfoot"]["catalogueLicenseClaim"]
    assert sources["openfootball-europe"]["status"] == "NO_2025_26_RPL_ARCHIVE"
    assert sources["football-data-uk"]["selected"] is False
    assert sources["football-data-uk"]["sourceContentSha256"] is None
    assert sources["rsssf"]["status"] == "EDITORIAL_CORROBORATION_ONLY"
    assert sources["footbolno"]["status"] == "EXCLUDED_BY_OWNER_DIRECTION"
    gates = review["studyGates"]
    assert all(flag is False for key, flag in gates.items()
               if key != "productionForecastsWritten")
    assert gates["productionForecastsWritten"] == 0
    assert review["theoreticalEligibleFixtures"] == 14 * 13
    assert review["theoreticalAbstentions"] == 240 - 182
