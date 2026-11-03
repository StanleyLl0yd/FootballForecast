"""Research-only regularized independent-Poisson baseline. No source I/O or publishing.

The caller must separately attest the training season, provenance, rights and
sealed-holdout exclusion before passing matches. This pure solver does not do so.
"""
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from math import exp, isfinite, log

from football_forecast.data.contracts import DataError, FinishedMatch
from football_forecast.data.training_input import TrainingFixture
from football_forecast.data.openfootball_training import CalendarTrainingFixture
from football_forecast.models.poisson import ScoreDistribution, poisson_score_distribution

_RIDGE = 2.0
_MAX_ITERATIONS = 2400
_MIN_APPEARANCES = 16
_LOG_RATE_MAX = log(15.0)


class InsufficientTrainingData(DataError):
    """Unknown team or too few train-season appearances; no inferred fallback."""


@dataclass(frozen=True, slots=True)
class TeamStrengthModel:
    teams: tuple[str, ...]
    attack: tuple[float, ...]
    defence: tuple[float, ...]
    appearances: tuple[int, ...]
    intercept: float
    home_advantage: float
    training_matches: int

    def predict(self, home: str, away: str) -> ScoreDistribution:
        if home == away:
            raise DataError("fixture must contain two distinct teams")
        try:
            hi, ai = self.teams.index(home), self.teams.index(away)
        except ValueError as exc:
            raise InsufficientTrainingData("unseen club: cannot infer from holdout") from exc
        if min(self.appearances[hi], self.appearances[ai]) < _MIN_APPEARANCES:
            raise InsufficientTrainingData("fewer than 16 train-season matches for club")
        home_rate = exp(
            self.intercept + self.home_advantage + self.attack[hi] - self.defence[ai]
        )
        away_rate = exp(self.intercept + self.attack[ai] - self.defence[hi])
        if not (0 <= home_rate <= 15 and 0 <= away_rate <= 15):
            raise DataError("estimated goal intensity outside the supported Poisson contract")
        return poisson_score_distribution(home_rate, away_rate)


def fit_independent_poisson(
    matches: Sequence[FinishedMatch | TrainingFixture | CalendarTrainingFixture],
) -> TeamStrengthModel:
    """Fit fixed-v1 ridge Poisson strengths, without data fetching or evaluating labels.

    Any TrainingFixture must originate from the protected role/provenance-gated
    reader. Its source has no authenticated finish timestamp; none is invented.
    """
    calendar = [isinstance(m, CalendarTrainingFixture) for m in matches]
    if any(calendar):
        if not all(calendar):
            raise DataError("cannot mix calendar-only and timestamped training cohorts")
        records = sorted(matches, key=lambda m: (m.calendar_date_utc, m.match_id))
    else:
        records = sorted(matches, key=lambda m: (m.kickoff_at, m.match_id))
    if not records:
        raise InsufficientTrainingData("no train-season matches")
    match_ids = [match.match_id for match in records]
    pairs = [(m.home_team_id, m.away_team_id) for m in records]
    if len(set(match_ids)) != len(match_ids) or len(set(pairs)) != len(pairs):
        raise DataError("duplicate match or directed fixture")
    if len(records) > 240:
        raise DataError("one train season cannot contain more than 240 fixtures")
    clubs = tuple(sorted({t for m in records for t in (m.home_team_id, m.away_team_id)}))
    if len(clubs) < 2 or len(clubs) > 16:
        raise InsufficientTrainingData("invalid train-season club count")
    index = {team: i for i, team in enumerate(clubs)}
    counts = Counter(t for m in records for t in (m.home_team_id, m.away_team_id))
    games = [(index[m.home_team_id], index[m.away_team_id], m.home_goals, m.away_goals)
             for m in records]
    n, k = len(games), len(clubs)
    mu = log(max(0.25, sum(h + a for _, _, h, a in games) / (2 * n)))
    values = [mu, 0.0] + [0.0] * (2 * k)

    def assess(params: list[float]) -> tuple[float, list[float]]:
        intercept, home_advantage = params[:2]
        attacks, defences = params[2:2 + k], params[2 + k:]
        gradient = [0.0] * len(params)
        objective = 0.0
        for hi, ai, gh, ga in games:
            zh = intercept + home_advantage + attacks[hi] - defences[ai]
            za = intercept + attacks[ai] - defences[hi]
            if not -20.0 < zh < _LOG_RATE_MAX or not -20.0 < za < _LOG_RATE_MAX:
                return float("inf"), gradient
            lh, la = exp(zh), exp(za)
            objective += lh - gh * zh + la - ga * za
            dh, da = lh - gh, la - ga
            gradient[0] += dh + da
            gradient[1] += dh
            gradient[2 + hi] += dh
            gradient[2 + ai] += da
            gradient[2 + k + ai] -= dh
            gradient[2 + k + hi] -= da
        objective += _RIDGE * (home_advantage ** 2 + sum(x*x for x in attacks + defences)) / 2
        gradient[1] += _RIDGE * home_advantage
        for j in range(2, len(params)):
            gradient[j] += _RIDGE * params[j]
        objective /= n
        gradient = [g / n for g in gradient]
        for start in (2, 2 + k):
            mean = sum(gradient[start:start + k]) / k
            for j in range(start, start + k):
                gradient[j] -= mean
        return objective, gradient

    converged = False
    for _ in range(_MAX_ITERATIONS):
        objective, gradient = assess(values)
        if not isfinite(objective):
            raise DataError("non-finite training objective")
        norm_sq = sum(g * g for g in gradient)
        if norm_sq < 1e-12:
            converged = True
            break
        rate = 0.4
        for _ in range(32):
            candidate = [v - rate * g for v, g in zip(values, gradient, strict=True)]
            for start in (2, 2 + k):
                mean = sum(candidate[start:start + k]) / k
                for j in range(start, start + k):
                    candidate[j] -= mean
            new_objective, _ = assess(candidate)
            if new_objective <= objective - 1e-4 * rate * norm_sq:
                values = candidate
                break
            rate /= 2
        else:
            raise DataError("baseline optimizer did not find a finite descent step")
    if not converged:
        objective, gradient = assess(values)
        if not isfinite(objective) or sum(g*g for g in gradient) >= 1e-12:
            raise DataError("baseline optimizer failed to converge")
    model = TeamStrengthModel(
        teams=clubs,
        attack=tuple(values[2:2 + k]),
        defence=tuple(values[2 + k:]),
        appearances=tuple(counts[team] for team in clubs),
        intercept=values[0],
        home_advantage=values[1],
        training_matches=n,
    )
    if any(not isfinite(x) for x in values):
        raise DataError("non-finite fitted coefficient")
    return model
