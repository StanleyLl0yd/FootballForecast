"""Synthetic-only M3 five-fold baseline and negative-leakage regression."""
from dataclasses import replace

import pytest
from test_rpl_development_folds import synthetic_corpus

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_development_baseline import (
    BASELINE_VERSION,
    evaluate_synthetic_hda_baseline,
)
from football_forecast.research.rpl_development_folds import PLAN, VALIDATION_SEASONS


@pytest.fixture(scope="module")
def fixtures():
    return synthetic_corpus()


def test_frozen_five_fold_denominators_probabilities_and_scores(fixtures):
    result = evaluate_synthetic_hda_baseline(fixtures)
    assert result.plan == PLAN
    assert result.baseline == BASELINE_VERSION
    assert result.scored_matches == 1200
    assert len(result.folds) == 5
    assert tuple(f.validation_season for f in result.folds) == VALIDATION_SEASONS
    assert [f.training_matches for f in result.folds] == [480, 720, 960, 1200, 1440]
    assert [f.scored_matches for f in result.folds] == [240] * 5
    for fold in result.folds:
        assert sum(fold.training_outcomes_hda) == fold.training_matches
        expected = tuple((x + 1) / (fold.training_matches + 3)
                         for x in fold.training_outcomes_hda)
        assert fold.probabilities_hda == pytest.approx(expected)
        assert sum(fold.probabilities_hda) == pytest.approx(1)
        assert all(0 < p < 1 for p in fold.probabilities_hda)
        assert all(v > 0 for v in (fold.mean_log_loss, fold.mean_brier, fold.mean_rps))
        assert fold.classification == "NON_STRICT_RETROSPECTIVE"
        assert fold.synthetic_only and not fold.sealed_holdout_read
        assert not fold.bookmaker_superiority_claimed
    assert result.mean_log_loss == pytest.approx(
        sum(f.mean_log_loss for f in result.folds) / 5
    )
    assert result.mean_brier == pytest.approx(
        sum(f.mean_brier for f in result.folds) / 5
    )
    assert result.mean_rps == pytest.approx(
        sum(f.mean_rps for f in result.folds) / 5
    )
    assert result.synthetic_only and not result.real_source_eligibility_proven
    assert not result.sealed_holdout_read and not result.bookmaker_superiority_claimed


def test_input_order_is_irrelevant(fixtures):
    forward = evaluate_synthetic_hda_baseline(fixtures)
    assert evaluate_synthetic_hda_baseline(tuple(reversed(fixtures))) == forward


def test_validation_outcomes_cannot_fit_their_own_fold(fixtures):
    original = evaluate_synthetic_hda_baseline(fixtures)
    last = fixtures[-1]
    changed = replace(last, home_goals=20 if last.home_goals <= last.away_goals else 0,
                      away_goals=0 if last.home_goals <= last.away_goals else 20)
    after = evaluate_synthetic_hda_baseline((*fixtures[:-1], changed))
    assert [f.probabilities_hda for f in after.folds] == [
        f.probabilities_hda for f in original.folds
    ]
    assert after.folds[:4] == original.folds[:4]
    assert after.folds[4].training_outcomes_hda == original.folds[4].training_outcomes_hda


def test_prior_validation_year_can_enter_later_training_but_not_itself(fixtures):
    original = evaluate_synthetic_hda_baseline(fixtures)
    revised = tuple(
        replace(row, home_goals=20, away_goals=0) if row.season == "2020/21" else row
        for row in fixtures
    )
    after = evaluate_synthetic_hda_baseline(revised)
    assert after.folds[0].probabilities_hda == original.folds[0].probabilities_hda
    assert after.folds[1].probabilities_hda != original.folds[1].probabilities_hda


@pytest.mark.parametrize("change", [
    {"source_match_id": "provider_real_1"},
    {"season": "2025/26"},
    {"result_kind": "awarded"},
    {"status": "postponed"},
    {"home_goals": -1},
])
def test_refuses_non_synthetic_untrusted_or_sealed_input(fixtures, change):
    invalid = (replace(fixtures[0], **change), *fixtures[1:])
    with pytest.raises(DataError):
        evaluate_synthetic_hda_baseline(invalid)


def test_refuses_missing_or_duplicate_fixtures(fixtures):
    with pytest.raises(DataError):
        evaluate_synthetic_hda_baseline(fixtures[:-1])
    with pytest.raises(DataError):
        evaluate_synthetic_hda_baseline((*fixtures[:-1], fixtures[0]))
    with pytest.raises(DataError):
        evaluate_synthetic_hda_baseline(list(fixtures))
