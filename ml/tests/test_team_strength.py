from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError, FinishedMatch, MatchStatus
from football_forecast.models.team_strength import (
    InsufficientTrainingData,
    fit_independent_poisson,
)

START = datetime(2024, 7, 1, tzinfo=UTC)


def synthetic_season() -> tuple[FinishedMatch, ...]:
    games = []
    for hi in range(16):
        for ai in range(16):
            if ai == hi:
                continue
            t = START + timedelta(days=len(games))
            games.append(FinishedMatch(
                f"synthetic-{hi:02d}-{ai:02d}", t, t + timedelta(hours=2),
                f"club-{hi:02d}", f"club-{ai:02d}",
                2 if hi < 8 else 1, 1 if ai < 8 else 0,
            ))
    return tuple(games)


def test_fixed_poisson_training_is_deterministic_and_identifiable() -> None:
    games = synthetic_season()
    model = fit_independent_poisson(games)
    assert model == fit_independent_poisson(tuple(reversed(games)))
    assert model.training_matches == 240
    assert len(model.teams) == 16
    assert min(model.appearances) == 30
    assert sum(model.attack) == pytest.approx(0, abs=1e-10)
    assert sum(model.defence) == pytest.approx(0, abs=1e-10)
    assert model.home_advantage > 0
    probabilities = model.predict("club-00", "club-09")
    probabilities.validate()
    assert probabilities.home_win + probabilities.draw + probabilities.away_win == pytest.approx(1)


def test_unseen_team_never_uses_holdout_labels_as_strength_fallback() -> None:
    model = fit_independent_poisson(synthetic_season())
    with pytest.raises(InsufficientTrainingData, match="unseen"):
        model.predict("promoted-not-in-train", "club-01")
    with pytest.raises(DataError, match="distinct"):
        model.predict("club-01", "club-01")


def test_duplicate_fixtures_and_match_ids_are_rejected() -> None:
    games = list(synthetic_season())
    with pytest.raises(DataError, match="duplicate"):
        fit_independent_poisson([*games, games[0]])
    with pytest.raises(DataError, match="duplicate"):
        fit_independent_poisson([*games[:25], replace(games[25], match_id=games[3].match_id)])
    with pytest.raises(DataError, match="duplicate"):
        fit_independent_poisson([*games[:25], replace(games[0], match_id="new-id")])


def test_training_requires_verified_finished_played_records() -> None:
    with pytest.raises(InsufficientTrainingData, match="no train-season"):
        fit_independent_poisson([])
    games = synthetic_season()
    with pytest.raises(DataError, match="technical"):
        replace(games[0], status=MatchStatus.AWARDED)
    with pytest.raises(DataError, match="goals"):
        replace(games[0], home_goals=-1)


def test_small_sample_does_not_synthesize_unseen_club_forecast() -> None:
    game = synthetic_season()[0]
    model = fit_independent_poisson([game])
    with pytest.raises(InsufficientTrainingData, match="fewer than 16"):
        model.predict(game.home_team_id, game.away_team_id)
