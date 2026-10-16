"""Deterministic independent-Poisson score baseline, with explicit tail handling.

The supplied intensities are parameters, NOT estimates learned from real data.
This module is a computational primitive and does not publish forecasts.
"""
from dataclasses import dataclass
from math import exp, isfinite


@dataclass(frozen=True)
class ScoreDistribution:
    scores: dict[tuple[int, int], float]
    tail_mass: float
    home_win: float
    draw: float
    away_win: float
    expected_home: float
    expected_away: float

    def validate(self, tolerance: float = 1e-10) -> None:
        if abs(self.home_win + self.draw + self.away_win - 1.0) > tolerance:
            raise ValueError("1X2 probabilities do not sum to one")
        if abs(sum(self.scores.values()) + self.tail_mass - 1.0) > tolerance:
            raise ValueError("score probabilities and unmodelled tail do not sum to one")
        if min(self.home_win, self.draw, self.away_win, self.tail_mass) < -tolerance:
            raise ValueError("negative probability")


def _poisson_vector(expected: float, cutoff: int) -> list[float]:
    current = exp(-expected)
    items = [current]
    for goals in range(1, cutoff + 1):
        current *= expected / goals
        items.append(current)
    return items


def poisson_score_distribution(
    expected_home: float, expected_away: float, *, cutoff: int = 12, tolerance: float = 1e-12
) -> ScoreDistribution:
    """Integrate score-grid probabilities; never renormalize away the unseen tail.

    Outcome probabilities include *all* significant scores via an adaptive
    expansion. The displayed score grid is deliberately truncated; its
    residual tail is separately disclosed. Expansion fails closed if insufficient.
    """
    for value in (expected_home, expected_away):
        if not isfinite(value) or value < 0 or value > 15:
            raise ValueError("intensity must be finite and between 0 and 15")
    if not 0 <= cutoff <= 40:
        raise ValueError("cutoff must be in 0..40")
    if not 0 < tolerance < 0.001:
        raise ValueError("invalid tolerance")
    home_display = _poisson_vector(expected_home, cutoff)
    away_display = _poisson_vector(expected_away, cutoff)
    grid = {(i, j): a * b for i, a in enumerate(home_display) for j, b in enumerate(away_display)}
    tail_mass = max(0.0, 1.0 - sum(grid.values()))

    size = max(cutoff, 12)
    while True:
        home = _poisson_vector(expected_home, size)
        away = _poisson_vector(expected_away, size)
        outside = max(0.0, 1.0 - sum(home) * sum(away))
        if outside < tolerance:
            break
        size += 5
        if size > 100:
            raise ValueError("cannot integrate full score distribution to tolerance")
    win = draw = loss = 0.0
    for i, a in enumerate(home):
        for j, b in enumerate(away):
            q = a * b
            if i > j:
                win += q
            elif i == j:
                draw += q
            else:
                loss += q
    normalizer = win + draw + loss
    result = ScoreDistribution(
        scores=grid, tail_mass=tail_mass, home_win=win / normalizer,
        draw=draw / normalizer, away_win=loss / normalizer,
        expected_home=expected_home, expected_away=expected_away,
    )
    result.validate()
    return result
