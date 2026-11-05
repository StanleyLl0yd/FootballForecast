"""Synthetic-only temporal RPL feature contract and leakage tests."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import (
    CLASSIFICATION,
    DevelopmentMatch,
    build_development_features,
)


def match(day, home, away, hg, ag, *, season="2020/21"):
    year = int(season[:4])
    return DevelopmentMatch(
        season, f"{season}-{day}-{home}-{away}",
        datetime(year, 9, day, 14, tzinfo=UTC),
        home, away, hg, ag, result_kind="played",
    )


def test_same_day_results_cannot_leak_to_any_same_day_game():
    a = match(10, "A", "B", 10, 0)
    b = match(10, "A", "C", 0, 1)
    c = match(11, "A", "D", 1, 1)
    rows = build_development_features((a, b, c))
    assert rows[0].home_unseen
    assert rows[1].home_prior_matches == 0
    assert rows[1].home_recent_goals_for == 0
    assert rows[2].home_prior_matches == 2
    assert rows[2].home_recent_goals_for == 10
    assert rows[2].home_recent_goals_against == 1
    assert rows[2].home_rest_days == 1
    assert rows[2].research_classification == CLASSIFICATION
    assert rows[0].information_cutoff.hour == 0


def test_shuffle_and_future_label_changes_leave_previous_features_intact():
    a, b = match(10, "A", "B", 3, 1), match(20, "A", "C", 0, 2)
    original = build_development_features((a, b))
    assert original == build_development_features((b, a))
    revised = build_development_features((a, replace(b, home_goals=18)))
    assert original == revised


def test_only_five_most_recent_earlier_days_and_rest_are_used():
    old = tuple(match(i, "A", f"X{i}", i % 4, i % 2) for i in range(1, 7))
    row = build_development_features((*old, match(20, "A", "B", 1, 0)))[-1]
    assert row.home_prior_matches == 6
    assert row.home_prior_home_matches == 6
    assert row.home_recent_count == 5
    assert row.home_recent_goals_for == sum(i % 4 for i in range(2, 7))
    assert row.home_rest_days == 14


def test_clubs_are_scoped_by_season_until_cross_season_identity_is_reviewed():
    old = match(10, "A", "B", 5, 0, season="2020/21")
    new = match(12, "A", "C", 1, 1, season="2021/22")
    rows = build_development_features((old, new))
    assert rows[1].home_prior_matches == 0
    assert rows[1].home_unseen


def test_sealed_holdout_awarded_score_naive_time_and_duplicates_fail():
    good = match(10, "A", "B", 0, 0)
    invalid = (
        replace(good, season="2025/26"),
        replace(good, status="awarded"),
        replace(good, result_kind="awarded"),
        replace(good, result_kind="unverified"),
        replace(good, home_goals=-1),
        replace(good, kickoff_at=datetime(2020, 9, 10)),
        replace(good, kickoff_at=good.kickoff_at + timedelta(days=3650)),
        replace(good, home_team_id="B"),
    )
    for bad in invalid:
        with pytest.raises(DataError):
            build_development_features((bad,))
    with pytest.raises(DataError):
        build_development_features((good, good))
    with pytest.raises(DataError):
        build_development_features(())


def test_same_day_label_changes_leave_current_features_unchanged():
    a, b = match(10, "A", "B", 2, 2), match(10, "C", "A", 0, 4)
    c = match(11, "B", "C", 1, 0)
    baseline = build_development_features((a, b, c))
    updated = build_development_features((
        replace(a, home_goals=19), replace(b, away_goals=17), c,
    ))
    assert baseline[:2] == updated[:2]
    assert baseline[2] != updated[2]
