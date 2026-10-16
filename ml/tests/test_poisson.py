import math

import pytest

from football_forecast.models.poisson import poisson_score_distribution


@pytest.mark.parametrize('home,away', [(0.0, 0.0), (0.9, 1.9), (2.2, 1.1), (15.0, 15.0)])
def test_probability_mass(home: float, away: float) -> None:
    result = poisson_score_distribution(home, away, cutoff=6)
    result.validate()
    assert result.tail_mass >= 0
    assert math.isclose(sum(result.scores.values()) + result.tail_mass, 1, abs_tol=1e-10)


def test_symmetry() -> None:
    result = poisson_score_distribution(1.3, 1.3)
    assert math.isclose(result.home_win, result.away_win, abs_tol=1e-12)


def test_zero_intensity() -> None:
    result = poisson_score_distribution(0, 0)
    assert result.draw == pytest.approx(1.0)
    assert result.scores[(0, 0)] == pytest.approx(1.0)


def test_unshown_tail_does_not_bias_1x2() -> None:
    low = poisson_score_distribution(3.2, 0.8, cutoff=2)
    high = poisson_score_distribution(3.2, 0.8, cutoff=12)
    assert low.tail_mass > 0.5
    assert low.home_win == pytest.approx(high.home_win)
    assert low.draw == pytest.approx(high.draw)


@pytest.mark.parametrize('home,away', [(-1, 2), (float('nan'), 1), (float('inf'), 1), (16, 1)])
def test_invalid_intensities(home: float, away: float) -> None:
    with pytest.raises(ValueError):
        poisson_score_distribution(home, away)
