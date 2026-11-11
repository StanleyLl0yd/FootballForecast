"""Synthetic-only receipt tests; real private results never enter CI."""

from dataclasses import asdict
from decimal import Decimal

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_owner_study_receipt import (
    COLUMNS,
    SCORED,
    TRAIN,
    YEARS,
    audit_owner_study_aggregates,
)

SHA = "a" * 40
SQL = "SELECT " + "x" * 2990


def synthetic_rows() -> list[dict]:
    return [
        {
            "validation_season": season,
            "train_n": TRAIN[i],
            "scored_n": SCORED[i],
            "abstained_n": 240 - SCORED[i],
            "unseen_n": 10,
            "baseline_log_loss": Decimal("1.070000"),
            "poisson_log_loss": Decimal("1.020000"),
            "paired_log_loss_gain": Decimal("0.050000"),
            "paired_gain_approx_95pct_halfwidth": Decimal("0.030000"),
            "baseline_brier": Decimal("0.640000"),
            "poisson_brier": Decimal("0.600000"),
            "baseline_rps": Decimal("0.460000"),
            "poisson_rps": Decimal("0.410000"),
        }
        for i, season in enumerate(YEARS)
    ]


def test_synthetic_receipt_contains_no_private_rows_or_metrics():
    rows = synthetic_rows()
    assert all(tuple(x) == COLUMNS for x in rows)
    result = audit_owner_study_aggregates(rows, code_sha=SHA, sql_text=SQL)
    content = asdict(result)
    assert result.validatedFolds == 5
    assert result.candidateScoredMatches == 1197
    assert result.withheldValidationCandidates == 3
    assert result.poissonBetterLogLossFolds == 5
    assert result.poissonBetterBrierFolds == 5
    assert result.poissonBetterRpsFolds == 5
    assert result.holdout2025_26Read is False
    assert result.privateRowsExported is False
    assert result.modelPersisted is False
    assert result.publicForecastsWritten is False
    assert result.acceptanceGranted is False
    assert len(result.aggregateResultsSha256) == 64
    assert len(result.querySha256) == 64
    assert not any(key in content for key in (
        "home_team_id", "away_team_id", "source_match_id",
        "baseline_log_loss", "poisson_log_loss", "privateRows",
    ))
    assert audit_owner_study_aggregates(
        synthetic_rows(), code_sha=SHA, sql_text=SQL
    ) == result


@pytest.mark.parametrize(("key", "value"), [
    ("validation_season", "2025/26"),
    ("train_n", 500),
    ("scored_n", 239),
    ("abstained_n", 1),
    ("unseen_n", 241),
    ("poisson_log_loss", Decimal("NaN")),
    ("paired_log_loss_gain", Decimal("0.900000")),
    ("baseline_brier", Decimal("Infinity")),
])
def test_refuses_wrong_fold_or_score_metadata(key: str, value: object):
    rows = synthetic_rows()
    rows[0][key] = value
    with pytest.raises(DataError):
        audit_owner_study_aggregates(rows, code_sha=SHA, sql_text=SQL)


def test_refuses_unexpected_private_source_field():
    rows = synthetic_rows()
    rows[1]["private_team_id"] = "forbidden"
    with pytest.raises(DataError):
        audit_owner_study_aggregates(rows, code_sha=SHA, sql_text=SQL)


def test_refuses_permuted_or_partial_data():
    rows = synthetic_rows()
    for changed in (rows[::-1], rows[:-1], []):
        with pytest.raises(DataError):
            audit_owner_study_aggregates(changed, code_sha=SHA, sql_text=SQL)


def test_accurately_reports_nonwinning_candidate_without_cherry_picking():
    rows = synthetic_rows()
    rows[2]["poisson_log_loss"] = Decimal("1.100000")
    rows[2]["paired_log_loss_gain"] = Decimal("-0.030000")
    rows[2]["poisson_brier"] = Decimal("0.650000")
    rows[2]["poisson_rps"] = Decimal("0.470000")
    result = audit_owner_study_aggregates(rows, code_sha=SHA, sql_text=SQL)
    assert result.poissonBetterLogLossFolds == 4
    assert result.poissonBetterBrierFolds == 4
    assert result.poissonBetterRpsFolds == 4


def test_refuses_invalid_sha_and_unbounded_sql():
    with pytest.raises(DataError):
        audit_owner_study_aggregates(synthetic_rows(), code_sha="b" * 39, sql_text=SQL)
    with pytest.raises(DataError):
        audit_owner_study_aggregates(synthetic_rows(), code_sha=SHA, sql_text="SELECT 1")
