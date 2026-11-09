"""M3 isolated synthetic-only multiseason team Poisson candidate, five fixed folds.

No network, filesystem, private rows, model persistence or M2 model refitting.
A synthetic_ identifier is a test convention, not proof of real provenance.
Cross-season club IDs here are fictional and may NOT be reused on real matches
until independent longitudinal-club identity eligibility is established.
"""
from collections import defaultdict
from dataclasses import dataclass
from hashlib import sha256
from json import dumps
from math import fsum

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.scoring import (
    brier_score,
    log_loss,
    ranked_probability_score,
)
from football_forecast.models.poisson import poisson_score_distribution
from football_forecast.research.rpl_development_folds import (
    PLAN,
    VALIDATION_SEASONS,
    plan_expanding_development_folds,
)
from football_forecast.research.rpl_temporal_features import CLASSIFICATION, DevelopmentMatch

MODEL_VERSION = "m3-synthetic-team-poisson-shrink12-v1"
TEAM_PSEUDO_MATCHES = 12
LEAGUE_PRIOR_MATCHES = 20
HOME_GOALS_PRIOR = 1.35
AWAY_GOALS_PRIOR = 1.05
MIN_RATE = 0.05
MAX_RATE = 6.0


@dataclass(slots=True)
class _Team:
    home_games: int = 0
    away_games: int = 0
    home_for: int = 0
    home_against: int = 0
    away_for: int = 0
    away_against: int = 0


@dataclass(frozen=True, slots=True)
class SyntheticPoissonFold:
    validation_season: str
    training_seasons: tuple[str, ...]
    training_matches: int
    scored_matches: int
    unseen_team_fixture_count: int
    training_model_sha256: str
    mean_log_loss: float
    mean_brier: float
    mean_rps: float
    candidate: str = MODEL_VERSION
    classification: str = CLASSIFICATION
    synthetic_only: bool = True
    real_training_authorized: bool = False
    sealed_holdout_read: bool = False
    bookmaker_superiority_claimed: bool = False


@dataclass(frozen=True, slots=True)
class SyntheticPoissonStudy:
    plan: str
    folds: tuple[SyntheticPoissonFold, ...]
    scored_matches: int
    mean_log_loss: float
    mean_brier: float
    mean_rps: float
    candidate: str = MODEL_VERSION
    classification: str = CLASSIFICATION
    synthetic_only: bool = True
    real_training_authorized: bool = False
    real_source_eligibility_proven: bool = False
    sealed_holdout_read: bool = False
    bookmaker_superiority_claimed: bool = False


def _outcome(row: DevelopmentMatch) -> int:
    if row.home_goals > row.away_goals:
        return 0
    if row.home_goals < row.away_goals:
        return 2
    return 1


def _clamp(rate: float) -> float:
    return max(MIN_RATE, min(MAX_RATE, rate))


def _training_state(
    train: tuple[DevelopmentMatch, ...],
    training_seasons: tuple[str, ...],
) -> tuple[dict[str, _Team], float, float, str]:
    teams: dict[str, _Team] = defaultdict(_Team)
    home_total = away_total = 0
    for row in train:
        home = teams[row.home_team_id]
        away = teams[row.away_team_id]
        home.home_games += 1
        home.home_for += row.home_goals
        home.home_against += row.away_goals
        away.away_games += 1
        away.away_for += row.away_goals
        away.away_against += row.home_goals
        home_total += row.home_goals
        away_total += row.away_goals
    n = len(train)
    if not n:
        raise DataError("M3 synthetic Poisson: empty training cohort")
    home_rate = (home_total + LEAGUE_PRIOR_MATCHES * HOME_GOALS_PRIOR) / (
        n + LEAGUE_PRIOR_MATCHES
    )
    away_rate = (away_total + LEAGUE_PRIOR_MATCHES * AWAY_GOALS_PRIOR) / (
        n + LEAGUE_PRIOR_MATCHES
    )
    if not 0 < home_rate <= 20 or not 0 < away_rate <= 20:
        raise DataError("M3 synthetic Poisson: invalid league scoring rate")
    # Fingerprint ONLY synthetic train years/club aggregate statistics. This
    # digest never ingests validation outcomes, M2 coefficients or private IDs.
    digest_input = {
        "version": MODEL_VERSION,
        "seasons": training_seasons,
        "training_count": n,
        "league_home_goals": home_total,
        "league_away_goals": away_total,
        "teams": [
            [club, stats.home_games, stats.away_games, stats.home_for,
             stats.home_against, stats.away_for, stats.away_against]
            for club, stats in sorted(teams.items())
        ],
    }
    digest = sha256(dumps(digest_input, sort_keys=True, separators=(",", ":"),
                          allow_nan=False).encode("utf-8")).hexdigest()
    return teams, home_rate, away_rate, digest


def _forecast(
    teams: dict[str, _Team],
    league_home: float,
    league_away: float,
    home_id: str,
    away_id: str,
) -> tuple[float, float, float]:
    home = teams.get(home_id, _Team())
    away = teams.get(away_id, _Team())
    pseudo = TEAM_PSEUDO_MATCHES
    home_attack = (home.home_for + pseudo * league_home) / (home.home_games + pseudo)
    away_defence = (away.away_against + pseudo * league_home) / (away.away_games + pseudo)
    away_attack = (away.away_for + pseudo * league_away) / (away.away_games + pseudo)
    home_defence = (home.home_against + pseudo * league_away) / (home.home_games + pseudo)
    expected_home = _clamp(home_attack * away_defence / league_home)
    expected_away = _clamp(away_attack * home_defence / league_away)
    dist = poisson_score_distribution(expected_home, expected_away, cutoff=8)
    return (dist.home_win, dist.draw, dist.away_win)


def _mean(items: list[float]) -> float:
    if not items:
        raise DataError("M3 synthetic Poisson: empty metric cohort")
    return fsum(items) / len(items)


def evaluate_synthetic_team_poisson(
    fixtures: tuple[DevelopmentMatch, ...],
) -> SyntheticPoissonStudy:
    """Fixed historical expanding-window design, fictional clubs only.

    Each fold fits its team aggregate exclusively from earlier seasons. The
    validation season supplies outcomes for offline scoring ONLY and never
    updates the same fold's fitted rates or training fingerprint.
    New synthetic clubs use the prespecified smoothed league priors.
    """
    folds = plan_expanding_development_folds(fixtures)
    if any(not row.source_match_id.startswith("synthetic_") for row in fixtures):
        raise DataError("M3 synthetic Poisson: synthetic fixture IDs required")
    if len(folds) != len(VALIDATION_SEASONS):
        raise DataError("M3 synthetic Poisson: unexpected fold plan")
    ordered = tuple(sorted(fixtures, key=lambda row: (
        row.season, row.kickoff_at, row.source_match_id
    )))
    results: list[SyntheticPoissonFold] = []
    for fold in folds:
        train = tuple(r for r in ordered if r.season in fold.training_seasons)
        validation = tuple(r for r in ordered if r.season == fold.validation_season)
        if len(train) != fold.training_matches or len(validation) != fold.validation_matches:
            raise DataError("M3 synthetic Poisson: incorrect fold membership")
        teams, home_rate, away_rate, digest = _training_state(train, fold.training_seasons)
        log_scores: list[float] = []
        brier_scores: list[float] = []
        rps_scores: list[float] = []
        unseen = 0
        for row in validation:
            unseen += int(row.home_team_id not in teams or row.away_team_id not in teams)
            probabilities = _forecast(
                teams, home_rate, away_rate, row.home_team_id, row.away_team_id
            )
            label = _outcome(row)
            log_scores.append(log_loss(probabilities, label))
            brier_scores.append(brier_score(probabilities, label))
            rps_scores.append(ranked_probability_score(probabilities, label))
        results.append(SyntheticPoissonFold(
            validation_season=fold.validation_season,
            training_seasons=fold.training_seasons,
            training_matches=len(train),
            scored_matches=len(validation),
            unseen_team_fixture_count=unseen,
            training_model_sha256=digest,
            mean_log_loss=_mean(log_scores),
            mean_brier=_mean(brier_scores),
            mean_rps=_mean(rps_scores),
        ))
    if tuple(r.validation_season for r in results) != VALIDATION_SEASONS:
        raise DataError("M3 synthetic Poisson: validation chronology changed")
    count = sum(r.scored_matches for r in results)
    if count != 1200:
        raise DataError("M3 synthetic Poisson: invalid scored match denominator")

    def pooled(name: str) -> float:
        return fsum(getattr(r, name) * r.scored_matches for r in results) / count

    return SyntheticPoissonStudy(
        plan=PLAN,
        folds=tuple(results),
        scored_matches=count,
        mean_log_loss=pooled("mean_log_loss"),
        mean_brier=pooled("mean_brier"),
        mean_rps=pooled("mean_rps"),
    )
