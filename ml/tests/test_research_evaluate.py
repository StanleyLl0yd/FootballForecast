"""Synthetic fixtures only: no production holdout rows or predictions."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.data.training_input import read_training_input
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.evaluate import (
    ResearchHoldoutBatch,
    ResearchHoldoutFixture,
    evaluate_fixed_locked_holdout,
)
from football_forecast.research.locking import prepare_pre_holdout_lock
from test_research_lock import COMMIT, SHA, SNAPSHOT, RETRIEVED, SyntheticCursor, mapping, report, rows


def test_stable_non_strict_scoring_and_train_only_prior():
    lock, model, cohort = synthetic_study()
    result = evaluate_fixed_locked_holdout(lock, model, cohort)
    assert result == evaluate_fixed_locked_holdout(lock, model, cohort)
    assert result.count == 240
    assert result.exclusions_unseen_club == 0
    for value in (result.model_log_loss, result.model_brier, result.model_rps,
                  result.training_prior_log_loss, result.training_prior_brier,
                  result.training_prior_rps):
        assert value is not None and 0 <= value < 10
    public = result.as_dict()
    assert public["uncertainty"] == "INCONCLUSIVE"
    assert public["researchClassification"] == "NON_STRICT_RETROSPECTIVE"
    assert public["strictHistoricalAsOfVerified"] is False
    assert public["calibrationOrSuperiorityClaimed"] is False
    assert "synthetic-" not in str(public)
    assert "CLUB_" not in str(public)


def synthetic_study():
    cursor = SyntheticCursor(rows())
    lock = prepare_pre_holdout_lock(
        cursor, snapshot_id=SNAPSHOT, source_sha256=SHA,
        code_sha=COMMIT, club_mapping=mapping(), corroboration=report(),
    )
    dataset = read_training_input(
        SyntheticCursor(rows()), snapshot_id=SNAPSHOT, source_sha256=SHA,
    )
    training = [replace(
        row, home_team_id=mapping()[row.home_team_id],
        away_team_id=mapping()[row.away_team_id],
    ) for row in dataset.fixtures]
    model = fit_independent_poisson(training)
    fixtures = []
    for h in range(16):
        for a in range(16):
            if h == a:
                continue
            kickoff = datetime(2025, 8, 1, tzinfo=UTC) + timedelta(days=len(fixtures)//4)
            fixtures.append(ResearchHoldoutFixture(
                f"synthetic-holdout-{h}-{a}", kickoff, f"CLUB_{h:02}",
                f"CLUB_{a:02}", h % 2, a % 3, True,
            ))
    return lock, model, ResearchHoldoutBatch(
        SNAPSHOT, SHA, RETRIEVED, "2025/2026", "sealed_holdout", tuple(fixtures),
    )


def test_unseen_promoted_club_abstains_without_using_labels_to_infer_strengths():
    lock, model, batch = synthetic_study()
    fixtures = tuple(replace(
        f, home_team_id=("PROMOTED" if f.home_team_id == "CLUB_15" else f.home_team_id),
        away_team_id=("PROMOTED" if f.away_team_id == "CLUB_15" else f.away_team_id),
    ) for f in batch.fixtures)
    result = evaluate_fixed_locked_holdout(lock, model, replace(batch, fixtures=fixtures))
    assert result.count == 210
    assert result.exclusions_unseen_club == 30


def test_holdout_identity_and_model_sha_are_strictly_locked():
    lock, model, cohort = synthetic_study()
    failures = [
        (replace(lock, fitted_model_sha256="0"*64), model, cohort),
        (replace(lock, train_outcome_counts=(1, 1, 1)), model, cohort),
        (lock, model, replace(cohort, role="train_baseline")),
        (lock, model, replace(cohort, season="2024/2025")),
        (lock, model, replace(cohort, source_sha256="b"*64)),
        (lock, model, replace(cohort, snapshot_id="b"*36)),
        (lock, model, replace(cohort, fixtures=cohort.fixtures[:239])),
    ]
    for bad_lock, bad_model, bad_batch in failures:
        with pytest.raises(DataError):
            evaluate_fixed_locked_holdout(bad_lock, bad_model, bad_batch)


def test_bad_scores_status_missing_kickoff_and_duplicates_fail_closed():
    lock, model, batch = synthetic_study()
    for modified in (
        replace(batch.fixtures[0], home_goals=21),
        replace(batch.fixtures[0], status="awarded"),
        replace(batch.fixtures[0], confirmed_kickoff=False),
        replace(batch.fixtures[0], kickoff_at=datetime(2025, 8, 1)),
        replace(batch.fixtures[0], home_team_id=batch.fixtures[0].away_team_id),
        replace(batch.fixtures[0], match_id=batch.fixtures[1].match_id),
    ):
        with pytest.raises(DataError):
            evaluate_fixed_locked_holdout(
                lock, model, replace(batch, fixtures=(modified, *batch.fixtures[1:])),
            )
