"""Frozen development-only expanding season splits. No I/O, fitting or holdout access.

Uses the seven private RPL source seasons 2018/19–2024/25 *only* after a
trusted caller has independently validated immutable archive provenance.
Never use this module to alter the pre-existing fixed 2024/25 M2 model.
"""
from collections import Counter
from dataclasses import dataclass
from datetime import datetime

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import (
    CLASSIFICATION,
    DEVELOPMENT_SEASONS,
    DevelopmentMatch,
    build_development_features,
)

PLAN = "rpl-seven-season-expanding-development-v1"
VALIDATION_SEASONS = DEVELOPMENT_SEASONS[2:]


@dataclass(frozen=True, slots=True)
class DevelopmentFold:
    plan: str
    training_seasons: tuple[str, ...]
    validation_season: str
    training_matches: int
    validation_matches: int
    training_last_kickoff: datetime
    validation_first_kickoff: datetime
    classification: str = CLASSIFICATION
    sealed_holdout_read: bool = False
    model_fitted: bool = False


def plan_expanding_development_folds(
    fixtures: tuple[DevelopmentMatch, ...],
) -> tuple[DevelopmentFold, ...]:
    """Five season-only non-overlapping validation folds.

    This validates source structure and outputs only the plan, not labels,
    team IDs, model parameters or per-match predictions.
    """
    if type(fixtures) is not tuple or len(fixtures) != 1680:
        raise DataError("RPL folds: require exactly seven 240-match development seasons")
    # Validate all inputs with the same sealed-season/date/identity protections
    # used for the already preregistered prior-day-only features.
    build_development_features(fixtures)
    seasons: dict[str, list[DevelopmentMatch]] = {
        season: [] for season in DEVELOPMENT_SEASONS
    }
    for row in fixtures:
        seasons[row.season].append(row)
    for season in DEVELOPMENT_SEASONS:
        records = seasons[season]
        if len(records) != 240:
            raise DataError("RPL folds: incomplete source season")
        # One club cannot play two distinct fixtures on the same UTC date.
        # Directed-pair completeness alone does not detect this source error.
        daily_appearances = Counter(
            (m.kickoff_at.date(), club)
            for m in records
            for club in (m.home_team_id, m.away_team_id)
        )
        if any(count > 1 for count in daily_appearances.values()):
            raise DataError("RPL folds: club scheduled twice on one UTC day")
        home = Counter(m.home_team_id for m in records)
        away = Counter(m.away_team_id for m in records)
        teams = set(home) | set(away)
        if (len(teams) != 16 or
                any(home[t] != 15 or away[t] != 15 for t in teams)):
            raise DataError("RPL folds: incomplete team home/away schedule")
    folds = []
    for i in range(2, len(DEVELOPMENT_SEASONS)):
        training = DEVELOPMENT_SEASONS[:i]
        validation = DEVELOPMENT_SEASONS[i]
        train_end = max(m.kickoff_at for season in training for m in seasons[season])
        validation_start = min(m.kickoff_at for m in seasons[validation])
        if not train_end < validation_start:
            raise DataError("RPL folds: training and validation event times overlap")
        folds.append(DevelopmentFold(
            plan=PLAN,
            training_seasons=training,
            validation_season=validation,
            training_matches=240 * i,
            validation_matches=240,
            training_last_kickoff=train_end,
            validation_first_kickoff=validation_start,
        ))
    return tuple(folds)
