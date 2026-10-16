"""Strictly proper scoring rules for 1X2; class order is H,D,A."""
from math import isfinite, log


def _validate(probs: tuple[float, float, float], outcome: int) -> None:
    if outcome not in (0, 1, 2) or isinstance(outcome, bool):
        raise ValueError("outcome must be H=0, D=1 or A=2")
    if len(probs) != 3 or any(not isfinite(p) or p < 0 or p > 1 for p in probs):
        raise ValueError("invalid probabilities")
    if abs(sum(probs) - 1.0) > 1e-9:
        raise ValueError("probabilities must sum to one")


def log_loss(probs: tuple[float, float, float], outcome: int) -> float:
    _validate(probs, outcome)
    return -log(max(probs[outcome], 1e-15))


def brier_score(probs: tuple[float, float, float], outcome: int) -> float:
    """Multiclass Brier: sum of squared differences, NOT divided by 3."""
    _validate(probs, outcome)
    return sum((p - float(index == outcome)) ** 2 for index, p in enumerate(probs))


def ranked_probability_score(probs: tuple[float, float, float], outcome: int) -> float:
    """Ordered categories H,D,A. Sum over first two cumulative thresholds."""
    _validate(probs, outcome)
    return sum((sum(probs[:k]) - float(outcome < k)) ** 2 for k in (1, 2))
