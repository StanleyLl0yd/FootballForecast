import math

import pytest

from football_forecast.evaluation.scoring import brier_score, log_loss, ranked_probability_score


def test_perfect_forecast() -> None:
    assert log_loss((1, 0, 0), 0) == pytest.approx(0)
    assert brier_score((1, 0, 0), 0) == 0
    assert ranked_probability_score((1, 0, 0), 0) == 0


def test_uniform_forecast() -> None:
    probs = (1 / 3, 1 / 3, 1 / 3)
    assert log_loss(probs, 1) == pytest.approx(math.log(3))
    assert brier_score(probs, 1) == pytest.approx(2 / 3)
    assert ranked_probability_score(probs, 1) == pytest.approx(2 / 9)


@pytest.mark.parametrize('scorer', [log_loss, brier_score, ranked_probability_score])
@pytest.mark.parametrize('outcome', [0.0, 1.0, 2.0, True, -1, 3])
def test_invalid_outcome_classes_rejected(scorer, outcome) -> None:
    with pytest.raises(ValueError):
        scorer((0.2, 0.6, 0.2), outcome)


@pytest.mark.parametrize('scorer', [log_loss, brier_score, ranked_probability_score])
@pytest.mark.parametrize('probs', [(True, 0.0, 0.0), (1.0, False, 0.0),
                                    (0.0, 0.0, None), (0.0, 0.0, '1')])
def test_reject_boolean_and_nonnumeric_probabilities(scorer, probs) -> None:
    with pytest.raises(ValueError):
        scorer(probs, 0)


def test_bad_probabilities() -> None:
    with pytest.raises(ValueError):
        brier_score((.5, .5, .5), 0)
    with pytest.raises(ValueError):
        ranked_probability_score((.5, .5, 0), 4)
