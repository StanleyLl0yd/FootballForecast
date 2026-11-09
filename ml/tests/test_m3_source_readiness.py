"""M3 bounded aggregate-only historical source readiness, never a training grant."""
from copy import deepcopy
from json import loads
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_source_readiness import (
    MISSING_CC0_PATHS,
    REFERENCE_SEASONS,
    STATUS,
    summarize_source_readiness,
)
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE_FILES = (
    "M2_PRIVATE_RPL_HISTORY_EVIDENCE.json",
    "M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json",
    "M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json",
    "M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json",
    "M2_PUBLIC_RPL_RESULT_REVISION_EVIDENCE.json",
    "M2_HISTORICAL_SOURCE_RIGHTS_GATE_EVIDENCE.json",
)


@pytest.fixture(scope="module")
def source_evidence():
    return tuple(loads((ROOT / "docs" / name).read_text(encoding="utf-8"))
                 for name in EVIDENCE_FILES)


def test_existing_aggregate_evidence_is_summarized_without_eligibility_claim(source_evidence):
    result = summarize_source_readiness(*source_evidence)
    assert tuple(row.season for row in result.seasons) == DEVELOPMENT_SEASONS
    assert [row.private_provider_rows for row in result.seasons] == [240] * 7
    assert result.total_private_provider_rows == 1680
    assert result.total_public_cc0_reference_rows == 1200
    assert result.confirmed_unplayed_public_cc0_awards == 6
    assert result.public_cc0_rows_without_inline_clock == 47
    assert result.public_cc0_directed_pair_anomalies == 1
    assert result.same_provider_adjacent_club_id_instances == 82
    assert result.independently_proven_eligible_private_rows == 0
    assert not result.real_training_authorized
    assert not result.private_rows_read and not result.sealed_holdout_read
    assert result.classification == "NON_STRICT_RETROSPECTIVE"
    assert all(row.status == STATUS and row.independently_proven_eligible_private_rows == 0
               for row in result.seasons)


def test_missing_public_cc0_paths_are_not_claimed_missing_from_all_archives(source_evidence):
    result = summarize_source_readiness(*source_evidence)
    references = {row.season: row for row in result.seasons}
    assert set(REFERENCE_SEASONS) == {
        season for season, row in references.items()
        if row.public_cc0_reference_rows == 240
    }
    assert set(MISSING_CC0_PATHS) == {
        season for season, row in references.items()
        if row.public_cc0_reference_rows is None
    }
    assert all(references[s].public_cc0_explicit_awards is None for s in MISSING_CC0_PATHS)
    assert references["2022/23"].known_public_revision_sample
    assert not references["2021/22"].known_public_revision_sample
    assert references["2023/24"].public_cc0_directed_pair_anomalies == 1
    assert references["2019/20"].public_cc0_explicit_awards == 4
    assert references["2020/21"].public_cc0_explicit_awards == 2
    # A missing inline clock in FOOTBALL.TXT does not prove missing historical
    # kickoff time everywhere, nor true original publication time.
    assert references["2024/25"].public_cc0_rows_without_inline_clock == 24


def test_even_perfect_same_provider_matching_never_proves_cross_provider_identity(
    source_evidence,
):
    result = summarize_source_readiness(*source_evidence)
    assert result.same_provider_adjacent_club_id_instances == 82
    assert result.independently_proven_eligible_private_rows == 0
    assert not result.real_training_authorized


@pytest.mark.parametrize("source_index,path,new_value", [
    (0, ("databaseVerification", "matchCount"), 1679),
    (0, ("run", "importReceipt", "holdoutRead"), True),
    (0, ("run", "importReceipt", "modelTrainingApproved"), True),
    (0, ("databaseVerification", "seasons"), [
        "2025/26", *DEVELOPMENT_SEASONS[1:]
    ]),
    (1, ("developmentSeasonsObserved", 1, "explicitAwardedStatusRows"), 0),
    (1, ("developmentSeasonsObserved", 3, "uniqueDirectedPairs"), 240),
    (1, ("unavailableInCheckedCc0RplPaths",), []),
    (2, ("awarded", "independentlyCorroboratedAsNotPlayed"), 5),
    (2, ("scheduleSwap", "automaticArchiveCorrectionPermitted"), True),
    (3, ("observedUniqueClubIds",), 27),
    (3, ("consecutiveOverlaps", 0, "sharedIds"), 15),
    (4, ("sample", "originalFieldResultLaterAnnulled"), False),
    (5, ("gates", "privateMatchIdentityCrosswalkApproved"), True),
])
def test_refuses_changed_evidence_or_false_training_claim(
    source_evidence, source_index, path, new_value,
):
    evidence = deepcopy(source_evidence)
    node = evidence[source_index]
    for segment in path[:-1]:
        node = node[segment]
    node[path[-1]] = new_value
    with pytest.raises(DataError, match="M3 readiness:"):
        summarize_source_readiness(*evidence)


def test_refuses_wrong_evidence_type_or_structure(source_evidence):
    corrupted = list(deepcopy(source_evidence))
    corrupted[1] = {"kind": source_evidence[1]["kind"], "developmentSeasonsObserved": []}
    with pytest.raises(DataError):
        summarize_source_readiness(*corrupted)
    corrupted = list(deepcopy(source_evidence))
    corrupted[3]["perSeason"] = "unverified"
    with pytest.raises(DataError):
        summarize_source_readiness(*corrupted)
