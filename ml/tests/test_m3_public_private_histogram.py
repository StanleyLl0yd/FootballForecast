"""M3 five-season histogram: public pinned metadata and privacy refusals."""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_public_private_histogram import (
    audit_five_season_histogram_receipt,
)

DOCS = Path(__file__).resolve().parents[2] / "docs"


def _receipts():
    current = json.loads(
        (DOCS / "M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_EVIDENCE.json").read_text(
            encoding="utf-8"
        )
    )
    old = json.loads(
        (DOCS / "M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json").read_text(
            encoding="utf-8"
        )
    )
    return current, old


def test_aggregate_match_and_public_anomaly_receipt_is_non_training():
    current, old = _receipts()
    result = audit_five_season_histogram_receipt(current, old)
    assert result.publicly_checked_matches == 1200
    assert result.perfect_raw_date_score_seasons == 4
    assert result.raw_date_score_l1_difference == 2
    assert result.isolated_public_anomaly_correction_l1 == 0
    assert result.certified_training_rows == 0
    assert result.model_training_authorized is False


@pytest.mark.parametrize(
    ("scope", "key", "value"),
    [
        ("root", "schemaVersion", True),
        ("root", "kind", "UNVERIFIED_KIND"),
        ("root", "scope", "HOLDOUT_2025_26"),
        ("root", "sourceCoverage", "ALL_SEVEN"),
        ("summary", "publicRowsAcrossCheckedSeasons", 1680),
        ("summary", "rawDateScoreHistogramL1Total", 0),
        ("summary", "corrected2023_24DateScoreHistogramL1", 2),
        ("summary", "certifiedPrivatePlayedRows", 1200),
        ("isolatedPublicAnomalySimulation", "archiveMutated", True),
        ("isolatedPublicAnomalySimulation", "hypotheticalDateScoreL1", 2),
        ("isolatedPublicAnomalySimulation", "lineNumberOneBased", 328),
        ("limitations", "privateMatchesExported", True),
        ("limitations", "privateClubIdsExported", True),
        ("limitations", "privatePerMatchScoreValuesExported", True),
        ("limitations", "realHistoricalKickoffUtcVerified", True),
        ("limitations", "playedVsAwardedGoalsVerified", True),
        ("limitations", "sourceTrainingRightsVerified", True),
        ("limitations", "trainingEligiblePrivateRowsCertified", True),
        ("limitations", "holdout2025_26Read", True),
        ("limitations", "m3A3Accepted", True),
        ("limitations", "m3A4OrA5RealRun", True),
        ("limitations", "productionModelChanged", True),
    ],
)
def test_mutated_receipt_rejected(scope, key, value):
    cur, old = _receipts()
    bad = deepcopy(cur)
    if scope == "root":
        bad[key] = value
    else:
        bad[scope][key] = value
    with pytest.raises(DataError, match="M3 five-season histograms"):
        audit_five_season_histogram_receipt(bad, old)


@pytest.mark.parametrize("index", list(range(5)))
def test_any_pinned_source_or_scoreline_change_rejected(index):
    cur, old = _receipts()
    cur["seasons"][index]["publicGitBlobSha"] = "0" * 40
    with pytest.raises(DataError):
        audit_five_season_histogram_receipt(cur, old)
    cur, old = _receipts()
    cur["seasons"][index]["rawDateScoreHistogramL1"] = 4
    with pytest.raises(DataError):
        audit_five_season_histogram_receipt(cur, old)


def test_extra_private_field_and_previous_source_swap_refused():
    cur, old = _receipts()
    cur["seasons"][0]["privateId"] = "must_not_be_present"
    with pytest.raises(DataError):
        audit_five_season_histogram_receipt(cur, old)
    cur, old = _receipts()
    old["developmentSeasonsObserved"][0]["gitBlobSha"] = "f" * 40
    with pytest.raises(DataError):
        audit_five_season_histogram_receipt(cur, old)
