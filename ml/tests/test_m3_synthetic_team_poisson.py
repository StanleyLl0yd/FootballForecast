"""Synthetic-only multi-season M3 Poisson candidate: leakage and refusal tests."""
from dataclasses import replace
from math import isfinite

import pytest
from test_rpl_development_folds import synthetic_corpus

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_synthetic_team_poisson import (
    AWAY_GOALS_PRIOR,
    HOME_GOALS_PRIOR,
    LEAGUE_PRIOR_MATCHES,
    MAX_RATE,
    MIN_RATE,
    MODEL_VERSION,
    TEAM_PSEUDO_MATCHES,
    _forecast,
    _training_state,
    evaluate_synthetic_team_poisson,
)
from football_forecast.research.rpl_development_folds import PLAN, VALIDATION_SEASONS


@pytest.fixture(scope="module")
def fixtures():
    return synthetic_corpus()


@pytest.fixture(scope="module")
def study(fixtures):
    return evaluate_synthetic_team_poisson(fixtures)


def test_frozen_parameters_are_distinct_from_m2_and_not_tunable():
    assert MODEL_VERSION == "m3-synthetic-team-poisson-shrink12-v1"
    assert TEAM_PSEUDO_MATCHES == 12
    assert LEAGUE_PRIOR_MATCHES == 20
    assert HOME_GOALS_PRIOR == 1.35
    assert AWAY_GOALS_PRIOR == 1.05
    assert MIN_RATE == 0.05
    assert MAX_RATE == 6.0


def test_five_development_folds_report_honest_aggregate_only_metrics(study):
    assert study.plan == PLAN
    assert study.candidate == MODEL_VERSION
    assert study.scored_matches == 1200
    assert tuple(f.validation_season for f in study.folds) == VALIDATION_SEASONS
    assert [f.training_matches for f in study.folds] == [480, 720, 960, 1200, 1440]
    assert [f.scored_matches for f in study.folds] == [240] * 5
    assert all(f.unseen_team_fixture_count == 0 for f in study.folds)
    assert all(len(f.training_model_sha256) == 64 for f in study.folds)
    assert len(set(f.training_model_sha256 for f in study.folds)) == 5
    for fold in study.folds:
        assert fold.synthetic_only
        assert not fold.real_training_authorized
        assert not fold.sealed_holdout_read
        assert not fold.bookmaker_superiority_claimed
        assert fold.classification == "NON_STRICT_RETROSPECTIVE"
        assert all(isfinite(n) and n >= 0 for n in
                   (fold.mean_log_loss, fold.mean_brier, fold.mean_rps))
    for metric in ("mean_log_loss", "mean_brier", "mean_rps"):
        assert getattr(study, metric) == pytest.approx(
            sum(getattr(f, metric) for f in study.folds) / 5
        )
    assert study.synthetic_only and not study.real_training_authorized
    assert not study.real_source_eligibility_proven
    assert not study.sealed_holdout_read and not study.bookmaker_superiority_claimed


def test_input_permutation_never_changes_fitted_model_or_scores(fixtures, study):
    assert evaluate_synthetic_team_poisson(tuple(reversed(fixtures))) == study


def test_late_validation_label_cannot_affect_any_training_signature(fixtures, study):
    last = fixtures[-1]
    replacement = replace(last, home_goals=20, away_goals=0)
    modified = evaluate_synthetic_team_poisson((*fixtures[:-1], replacement))
    assert [f.training_model_sha256 for f in modified.folds] == [
        f.training_model_sha256 for f in study.folds
    ]
    assert modified.folds[:4] == study.folds[:4]
    assert modified.folds[4].training_matches == study.folds[4].training_matches


def test_previous_validation_labels_may_train_later_folds_but_not_their_own(
    fixtures, study,
):
    changed = tuple(
        replace(r, home_goals=20, away_goals=0) if r.season == "2020/21" else r
        for r in fixtures
    )
    modified = evaluate_synthetic_team_poisson(changed)
    assert modified.folds[0].training_model_sha256 == study.folds[0].training_model_sha256
    assert modified.folds[1].training_model_sha256 != study.folds[1].training_model_sha256
    assert modified.folds[1].training_matches == study.folds[1].training_matches


def test_promoted_fictional_club_uses_fixed_prior_not_future_labels(fixtures, study):
    replacement = tuple(replace(
        r,
        home_team_id="club_promoted" if r.home_team_id == "club_0" else r.home_team_id,
        away_team_id="club_promoted" if r.away_team_id == "club_0" else r.away_team_id,
    ) if r.season == "2024/25" else r for r in fixtures)
    modified = evaluate_synthetic_team_poisson(replacement)
    assert modified.folds[:4] == study.folds[:4]
    assert modified.folds[4].unseen_team_fixture_count == 30
    assert modified.folds[4].training_model_sha256 == study.folds[4].training_model_sha256
    assert modified.folds[4].scored_matches == 240


def test_unseen_home_and_away_use_prespecified_league_intensities(fixtures):
    train = tuple(r for r in fixtures if r.season in ("2018/19", "2019/20"))
    teams, home_rate, away_rate, _ = _training_state(train, ("2018/19", "2019/20"))
    probs = _forecast(teams, home_rate, away_rate, "synthetic_new_h", "synthetic_new_a")
    assert len(probs) == 3
    assert sum(probs) == pytest.approx(1)
    assert all(0 < p < 1 for p in probs)


@pytest.mark.parametrize("modifications", [
    {"source_match_id": "real_provider_id"},
    {"season": "2025/26"},
    {"result_kind": "awarded"},
    {"result_kind": "unverified"},
    {"status": "postponed"},
    {"home_goals": -1},
    {"away_goals": 21},
])
def test_refuses_non_synthetic_sealed_or_unplayed_inputs(fixtures, modifications):
    damaged = (replace(fixtures[0], **modifications), *fixtures[1:])
    with pytest.raises(DataError):
        evaluate_synthetic_team_poisson(damaged)


def test_refuses_incomplete_duplicated_and_untrusted_container(fixtures):
    with pytest.raises(DataError):
        evaluate_synthetic_team_poisson(fixtures[:-1])
    with pytest.raises(DataError):
        evaluate_synthetic_team_poisson((*fixtures[:-1], fixtures[0]))
    with pytest.raises(DataError):
        evaluate_synthetic_team_poisson(list(fixtures))
