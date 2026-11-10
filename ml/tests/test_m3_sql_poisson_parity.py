"""Numerical cross-check of the fixed 0..30 Poisson grid used by M3 SQL.

This tests arithmetic only on synthetic lambdas: it does not access any database
or real RPL fixture, or execute the consumed 2025/26 holdout.
"""
from math import exp, factorial, fsum

import pytest

from football_forecast.models.poisson import poisson_score_distribution


def _sql_grid_probabilities(home_rate: float, away_rate: float) -> tuple[float, ...]:
    """Mirror the SQL PMF expression, not the Python adaptive integration loop."""
    mass = [
        (exp(-home_rate-away_rate) * home_rate**home * away_rate**away
         / factorial(home) / factorial(away), home, away)
        for home in range(31) for away in range(31)
    ]
    total = fsum(p for p, _, _ in mass)
    home_win = fsum(p for p, home, away in mass if home > away) / total
    draw = fsum(p for p, home, away in mass if home == away) / total
    away_win = fsum(p for p, home, away in mass if home < away) / total
    return home_win, draw, away_win


@pytest.mark.parametrize(("home_rate", "away_rate"), [
    (0.05, 0.05),
    (0.75, 1.15),
    (1.35, 1.05),
    (2.7, 1.4),
    (6.0, 6.0),
    (6.0, 0.05),
])
def test_sql_poisson_grid_matches_adaptive_reference(
    home_rate: float, away_rate: float,
) -> None:
    reference = poisson_score_distribution(home_rate, away_rate, cutoff=8)
    actual = _sql_grid_probabilities(home_rate, away_rate)
    assert actual == pytest.approx(
        (reference.home_win, reference.draw, reference.away_win),
        abs=1e-10,
    )
    assert sum(actual) == pytest.approx(1.0, abs=1e-12)
