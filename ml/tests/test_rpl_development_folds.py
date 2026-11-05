"""Synthetic-only fixed seven-season expanding-fold integrity checks."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_development_folds import (
    PLAN,
    VALIDATION_SEASONS,
    plan_expanding_development_folds,
)
from football_forecast.research.rpl_temporal_features import DevelopmentMatch


def synthetic_corpus():
    matches = []
    for year in range(2018, 2025):
        season = f"{year}/{(year + 1) % 100:02d}"
        # Realistic double round-robin: eight disjoint fixtures each round.
        rotation = list(range(16))
        first_leg = []
        for round_no in range(15):
            for slot in range(8):
                home, away = rotation[slot], rotation[-slot - 1]
                if round_no % 2:
                    home, away = away, home
                first_leg.append((home, away, round_no))
            rotation = [rotation[0], rotation[-1], *rotation[1:-1]]
        schedule = first_leg + [
            (away, home, round_no + 15) for home, away, round_no in first_leg
        ]
        for idx, (h, a, round_no) in enumerate(schedule):
            kickoff = datetime(year, 9, 1, 15, tzinfo=UTC) + timedelta(days=round_no * 7)
            matches.append(DevelopmentMatch(
                season, f"synthetic_{year}_{idx}", kickoff,
                f"club_{h}", f"club_{a}", h % 3, a % 2, result_kind="played",
            ))
    return tuple(matches)


def test_fixed_five_expanding_folds_cover_only_prior_seasons():
    folds = plan_expanding_development_folds(synthetic_corpus())
    assert len(folds) == 5
    assert tuple(f.validation_season for f in folds) == VALIDATION_SEASONS
    assert [f.training_matches for f in folds] == [480, 720, 960, 1200, 1440]
    assert [f.validation_matches for f in folds] == [240] * 5
    assert all(f.training_last_kickoff < f.validation_first_kickoff for f in folds)
    assert all(f.plan == PLAN and not f.model_fitted and not f.sealed_holdout_read
               for f in folds)
    assert folds[0].training_seasons == ("2018/19", "2019/20")
    assert folds[-1].validation_season == "2024/25"


def test_fold_plan_is_invariant_to_input_order_and_outcomes():
    matches = synthetic_corpus()
    original = plan_expanding_development_folds(matches)
    modified = tuple(replace(row, home_goals=17, away_goals=0) for row in matches)
    assert plan_expanding_development_folds(tuple(reversed(matches))) == original
    assert plan_expanding_development_folds(modified) == original


def test_refuses_incomplete_duplicate_or_sealed_development_years():
    base = synthetic_corpus()
    with pytest.raises(DataError):
        plan_expanding_development_folds(base[:-1])
    with pytest.raises(DataError):
        plan_expanding_development_folds((*base[:-1], base[0]))
    with pytest.raises(DataError):
        plan_expanding_development_folds((replace(base[0], season="2025/26"), *base[1:]))
    with pytest.raises(DataError):
        plan_expanding_development_folds((replace(base[0], home_goals=21), *base[1:]))
    with pytest.raises(DataError):
        plan_expanding_development_folds(list(base))
    with pytest.raises(DataError):
        plan_expanding_development_folds((replace(base[0], result_kind="awarded"), *base[1:]))


def test_refuses_temporal_overlap_from_pandemic_season_boundary():
    rows = list(synthetic_corpus())
    train_idx = next(i for i, r in enumerate(rows) if r.season == "2019/20")
    eval_idx = next(i for i, r in enumerate(rows) if r.season == "2020/21")
    rows[train_idx] = replace(rows[train_idx], kickoff_at=datetime(2020, 7, 22, tzinfo=UTC))
    rows[eval_idx] = replace(rows[eval_idx], kickoff_at=datetime(2020, 7, 15, tzinfo=UTC))
    with pytest.raises(DataError, match="overlap"):
        plan_expanding_development_folds(tuple(rows))


def test_refuses_same_club_twice_in_one_utc_day_with_all_pairs_present():
    rows = list(synthetic_corpus())
    original = rows[0]
    other = next(i for i, row in enumerate(rows) if row.season == original.season
                 and row.kickoff_at != original.kickoff_at
                 and original.home_team_id in (row.home_team_id, row.away_team_id))
    rows[other] = replace(rows[other], kickoff_at=original.kickoff_at)
    with pytest.raises(DataError, match="twice on one UTC day"):
        plan_expanding_development_folds(tuple(rows))
