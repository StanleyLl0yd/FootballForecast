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


def test_bad_probabilities() -> None:
    with pytest.raises(ValueError):
        brier_score((.5, .5, .5), 0)
    with pytest.raises(ValueError):
        ranked_probability_score((.5, .5, 0), 4)
