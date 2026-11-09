"""M3 public RPL name roster continuity does not prove private club identity."""
from copy import deepcopy
from json import loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_public_club_rosters import (
    FROZEN_ADJACENT_OVERLAPS,
    NEGATIVE_GATES,
    PROTOCOL,
    PUBLIC_CLUB_ALIASES,
    audit_public_roster_topology,
)
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def evidence():
    return tuple(loads((ROOT / "docs" / filename).read_text(encoding="utf-8"))
                 for filename in (
                     "M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json",
                     "M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json",
                 ))


def test_frozen_public_roster_structure_agrees_with_private_sample_count_only(evidence):
    report = audit_public_roster_topology(*evidence)
    assert report.protocol == PROTOCOL
    assert report.season_count == 7 and report.club_appearances == 112
    assert report.distinct_public_aliases == 26
    assert report.adjacent_public_alias_overlaps == (14, 14, 14, 13, 14, 13)
    assert report.adjacent_public_alias_overlaps == FROZEN_ADJACENT_OVERLAPS
    assert report.public_overlap_total == 82
    assert report.private_sample_distinct_ids == 26
    assert report.private_sample_overlap_total == 82
    assert report.live_full_archive_distinct_provider_ids == 26
    assert report.live_full_archive_adjacent_overlaps == FROZEN_ADJACENT_OVERLAPS
    assert report.public_and_private_aggregate_shapes_coincide
    assert not report.private_id_to_name_mapping_verified
    assert not report.official_legal_club_continuity_verified
    assert not report.first_publication_time_verified
    assert not report.real_training_authorized
    assert not report.sealed_holdout_read and not report.private_rows_read
    assert len(PUBLIC_CLUB_ALIASES) == 26


def test_manual_names_only_are_not_a_private_id_or_fixture_crosswalk(evidence):
    public, _ = evidence
    assert [row["season"] for row in public["seasonReferences"]] == list(
        DEVELOPMENT_SEASONS
    )
    assert len(public["seasonReferences"]) == 7
    assert all(len(row["publicNameAliasesInFinalTableOrder"]) == 16
               and row["leagueGamesPerClubReported"] == 30
               for row in public["seasonReferences"])
    assert set().union(*(
        set(row["publicNameAliasesInFinalTableOrder"])
        for row in public["seasonReferences"]
    )) == PUBLIC_CLUB_ALIASES
    assert all(public["limitations"][k] is False for k in NEGATIVE_GATES)
    assert "Nizhniy Novgorod" in public["knownNameCaveats"][0]
    assert "Pari NN" in public["knownNameCaveats"][0]


@pytest.mark.parametrize(("source", "path", "replacement"), [
    (0, ("schemaVersion",), 2),
    (0, ("kind",), "TRAINING_APPROVED"),
    (0, ("seasonReferences", 0, "season"), "2025/26"),
    (0, ("seasonReferences", 1, "publicNameAliasesInFinalTableOrder", 0), "unknown"),
    (0, ("seasonReferences", 0, "publicNameAliasesInFinalTableOrder", 0), "cska"),
    (0, ("seasonReferences", 5, "sourcePage"), "https://example.org/football"),
    (0, ("seasonReferences", 0, "leagueGamesPerClubReported"), True),
    (0, ("aggregate", "totalAdjacentSharedPublicNameAliases"), 83),
    (0, ("aggregate", "privateProviderSourceSampleUniqueIds"), 27),
    (0, ("livePrivateArchiveReadOnlyEvidence", "uniqueProviderClubIds"), 27),
    (0, ("livePrivateArchiveReadOnlyEvidence", "perSeason", 3,
          "sharedProviderIdsWithNextSeason"), 14),
    (0, ("livePrivateArchiveReadOnlyEvidence", "providerIdsExported"), True),
    (0, ("livePrivateArchiveReadOnlyEvidence", "sealedHoldoutRead"), True),
    (0, ("livePrivateArchiveReadOnlyEvidence",
          "independentProviderIdToOfficialClubNameVerified"), True),
    (0, ("limitations", "privateProviderIdToPublicNameApproved"), True),
    (0, ("limitations", "realModelTrainingAuthorized"), True),
    (0, ("limitations", "sealed2025_26HoldoutRead"), True),
    (1, ("observedUniqueClubIds",), 27),
    (1, ("totalSharedAdjacentClubIdInstances",), 83),
    (1, ("consecutiveOverlaps", 0, "sharedIds"), 13),
    (1, ("limitations", "independentClubIdentityMappingAccepted"), True),
])
def test_mutated_public_roster_or_false_club_mapping_claim_is_rejected(
    evidence, source, path, replacement,
):
    public, private = deepcopy(evidence)
    obj = [public, private][source]
    for segment in path[:-1]:
        obj = obj[segment]
    obj[path[-1]] = replacement
    with pytest.raises(DataError, match="M3 public roster:"):
        audit_public_roster_topology(public, private)


def test_refuses_missing_season_duplicate_public_team_and_container_mutation(evidence):
    public, private = deepcopy(evidence)
    public["seasonReferences"] = public["seasonReferences"][:-1]
    with pytest.raises(DataError):
        audit_public_roster_topology(public, private)
    public, private = deepcopy(evidence)
    public["seasonReferences"][0]["publicNameAliasesInFinalTableOrder"] = [
        "zenit"] * 16
    with pytest.raises(DataError):
        audit_public_roster_topology(public, private)
    public, private = deepcopy(evidence)
    public["seasonReferences"] = tuple(public["seasonReferences"])
    with pytest.raises(DataError):
        audit_public_roster_topology(public, private)
