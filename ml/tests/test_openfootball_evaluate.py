"""Synthetic-only calendar-model scorer; never loads sealed 2025/26 records."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256

import pytest

from test_openfootball_training import fixture_doc
from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import (
    PROTOCOL, read_openfootball_calendar_training,
)
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.locking import _digest
from football_forecast.research.model_escrow import serialize_private_model
from football_forecast.research.openfootball_train import produce_openfootball_train_candidate
from football_forecast.research.openfootball_evaluate import (
    CalendarStudyLock, CalendarHoldoutFixture, CalendarHoldoutBatch,
    score_fixed_calendar_holdout,
)

HOLDOUT_SHA = "9" * 64
CROSSWALK_SHA = "8" * 64
RETRIEVED = datetime(2026, 8, 1, tzinfo=UTC)


@pytest.fixture(scope="module")
def research():
    # The sole model is fitted on conspicuously synthetic TRAIN fixtures.
    document = fixture_doc()
    rows, _ = read_openfootball_calendar_training(document)
    model = fit_independent_poisson(rows)
    receipt = produce_openfootball_train_candidate(document, code_sha="b" * 40)
    private = serialize_private_model(model, protocol=PROTOCOL)
    snapshot = "synthetic-holdout-meta"
    lock = CalendarStudyLock(
        train_code_sha=receipt["codeSha"],
        train_source_sha256=receipt["sourceBytesSha256"],
        train_rows_sha256=receipt["trainRowsSha256"],
        train_club_mapping_sha256=receipt["clubMappingSha256"],
        fitted_model_sha256=receipt["fittedModelSha256"],
        model_artifact_sha256=sha256(private).hexdigest(),
        holdout_source_sha256=HOLDOUT_SHA,
        holdout_snapshot_identity_sha256=_digest(
            [snapshot, HOLDOUT_SHA, RETRIEVED.isoformat()]
        ),
        holdout_crosswalk_sha256=CROSSWALK_SHA,
        train_outcome_counts_hda=(103, 65, 72),
    )
    names = model.teams
    order = list(range(16))
    fixtures = []
    for round_no in range(15):
        for leg in (0, 1):
            kickoff = (datetime(2025, 8, 1, 16, tzinfo=UTC)
                       + timedelta(days=round_no + 15 * leg))
            for i in range(8):
                home, away = order[i], order[15 - i]
                if leg:
                    home, away = away, home
                fixtures.append(CalendarHoldoutFixture(
                    match_id=f"synthetic-fixture-{len(fixtures):03}",
                    kickoff_at=kickoff, home_team_id=names[home],
                    away_team_id=names[away], home_goals=home % 3,
                    away_goals=away % 2, confirmed_kickoff=True,
                    result_kind="played", status="finished",
                ))
        order = [order[0], order[-1], *order[1:-1]]
    batch = CalendarHoldoutBatch(
        snapshot_id=snapshot, source_sha256=HOLDOUT_SHA,
        crosswalk_sha256=CROSSWALK_SHA, retrieved_at=RETRIEVED,
        season="2025/2026", role="sealed_holdout",
        fixtures=tuple(sorted(fixtures, key=lambda x: (x.kickoff_at, x.match_id))),
    )
    return lock, model, batch


def test_source_independent_fixed_model_scoring_is_reproducible(research):
    lock, model, cohort = research
    assert lock.train_source_sha256 != cohort.source_sha256
    result = score_fixed_calendar_holdout(lock, model, cohort)
    assert result == score_fixed_calendar_holdout(lock, model, cohort)
    assert result.count == 240
    assert result.exclusions_unseen_club == 0
    for key in (
        result.model_log_loss, result.model_brier, result.model_rps,
        result.training_prior_log_loss, result.training_prior_brier,
        result.training_prior_rps,
    ):
        assert key is not None and 0 <= key < 10
    report = result.as_dict()
    assert report["uncertainty"] == "INCONCLUSIVE"
    assert report["researchClassification"] == "NON_STRICT_RETROSPECTIVE"
    assert report["strictHistoricalAsOfVerified"] is False
    assert report["calibrationOrSuperiorityClaimed"] is False
    assert report["productionForecastsWritten"] == 0
    assert "synthetic-fixture" not in str(report)
    assert "S_" not in str(report)


def test_unseen_club_requires_abstention_without_label_based_aliases(research):
    lock, model, batch = research
    old = model.teams[-1]
    new = "U_" + "A" * 20
    changed = tuple(replace(
        row,
        home_team_id=new if row.home_team_id == old else row.home_team_id,
        away_team_id=new if row.away_team_id == old else row.away_team_id,
    ) for row in batch.fixtures)
    out = score_fixed_calendar_holdout(lock, model, replace(batch, fixtures=changed))
    assert out.count == 210
    assert out.exclusions_unseen_club == 30


def test_distinct_holdout_source_snapshot_and_model_are_pinned(research):
    lock, model, cohort = research
    for bad_lock, bad_batch in (
        (replace(lock, fitted_model_sha256="1"*64), cohort),
        (replace(lock, model_artifact_sha256="1"*64), cohort),
        (replace(lock, train_code_sha="invalid"), cohort),
        (replace(lock, train_outcome_counts_hda=(100,70,70)), cohort),
        (replace(lock, research_classification="STRICT_BACKTEST"), cohort),
        (replace(lock, holdout_read=True), cohort),
        (replace(lock, holdout_source_sha256=lock.train_source_sha256), cohort),
        (lock, replace(cohort, source_sha256="6"*64)),
        (lock, replace(cohort, crosswalk_sha256="4"*64)),
        (lock, replace(cohort, snapshot_id="other-snapshot")),
        (lock, replace(cohort, retrieved_at=datetime(2026, 1, 1, tzinfo=UTC))),
        (lock, replace(cohort, role="train_baseline")),
        (lock, replace(cohort, season="2024/2025")),
        (lock, replace(cohort, fixtures=cohort.fixtures[:239])),
    ):
        with pytest.raises(DataError):
            score_fixed_calendar_holdout(bad_lock, model, bad_batch)


def test_bad_or_awarded_matches_fail_before_any_metric(research):
    lock, model, batch = research
    first = batch.fixtures[0]
    second = batch.fixtures[1]
    for invalid in (
        replace(first, result_kind="awarded"),
        replace(first, status="awarded"),
        replace(first, confirmed_kickoff=False),
        replace(first, home_goals=21),
        replace(first, away_goals=True),
        replace(first, kickoff_at=datetime(2025, 8, 1, 16)),
        replace(first, kickoff_at=datetime(2024, 8, 1, tzinfo=UTC)),
        replace(first, home_team_id=first.away_team_id),
        replace(first, home_team_id="UNKNOWN"),
        replace(first, match_id=second.match_id),
        replace(first, kickoff_at=second.kickoff_at,
                home_team_id=second.home_team_id),
    ):
        with pytest.raises(DataError):
            score_fixed_calendar_holdout(
                lock, model, replace(batch, fixtures=(invalid, *batch.fixtures[1:])),
            )


def test_fake_source_authorization_is_not_exposed_as_an_api(research):
    lock, model, batch = research
    # Pure scorer has no public parameter that could authorize external I/O.
    assert not hasattr(lock, "authorized") and not hasattr(batch, "authorized")
    assert score_fixed_calendar_holdout(lock, model, batch).count == 240
