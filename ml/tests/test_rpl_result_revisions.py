"""Synthetic-only result revision timing and played-goal semantics."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_result_revisions import (
    ResultVersion,
    select_result_as_of,
)

KICKOFF = datetime(2022, 9, 10, 15, tzinfo=UTC)
PLAYED = ResultVersion(
    "2022/23", "synthetic-identity", "played", 1, 1,
    KICKOFF + timedelta(hours=3), True,
)
AWARDED = ResultVersion(
    "2022/23", "synthetic-identity", "awarded", 0, 3,
    KICKOFF + timedelta(days=4), True,
)


def select(versions, day, role="official_table"):
    return select_result_as_of(
        versions, kickoff_at=KICKOFF,
        cutoff_at=datetime(2022, 9, day, tzinfo=UTC), role=role,
    )


def test_later_technical_result_cannot_rewrite_earlier_historical_cutoff():
    versions = (PLAYED, AWARDED)
    assert select(versions, 10) is None
    assert select(versions, 12) == PLAYED
    assert select(versions, 14) == PLAYED
    assert select(versions, 15) == AWARDED
    assert select(versions, 15, "on_field_goals") == PLAYED


def test_technical_result_of_unplayed_game_never_becomes_played_goals():
    assert select((AWARDED,), 15) == AWARDED
    assert select((AWARDED,), 15, "on_field_goals") is None


@pytest.mark.parametrize("bad", [
    replace(AWARDED, original_availability_verified=False),
    replace(AWARDED, first_available_at=None),
    replace(AWARDED, first_available_at=KICKOFF),
    replace(AWARDED, first_available_at=KICKOFF.replace(tzinfo=None)),
    replace(AWARDED, first_available_at=KICKOFF + timedelta(hours=2)),
    replace(AWARDED, first_available_at=AWARDED.first_available_at.replace(
        tzinfo=timezone(timedelta(hours=2)))),
    replace(AWARDED, kind="finished"),
    replace(AWARDED, home_goals=True),
    replace(AWARDED, away_goals=21),
    replace(AWARDED, source_match_id="unmatched"),
    replace(AWARDED, season="2025/26"),
])
def test_unknown_or_invalid_versions_fail_closed(bad):
    with pytest.raises(DataError):
        select((PLAYED, bad), 15)


def test_conflicts_and_untrusted_clock_or_role_fail_closed():
    for versions in ((AWARDED, PLAYED), (PLAYED, PLAYED),
                     (PLAYED,) * 9, [PLAYED, AWARDED], ("bad",)):
        with pytest.raises(DataError):
            select(versions, 15)
    for cutoff, role in (
        (KICKOFF + timedelta(days=2), "official_table"),
        (datetime(2022, 9, 15), "official_table"),
        (datetime(2022, 9, 15, tzinfo=UTC), "unknown"),
    ):
        with pytest.raises(DataError):
            select_result_as_of((PLAYED,), kickoff_at=KICKOFF,
                                cutoff_at=cutoff, role=role)


@pytest.mark.parametrize("bad_kickoff", [
    datetime(2022, 6, 30, 15, tzinfo=UTC),
    datetime(2023, 7, 1, 15, tzinfo=UTC),
    datetime(2025, 9, 10, 15, tzinfo=UTC),
])
def test_relabelled_or_out_of_season_kickoff_cannot_pass_revision_gate(bad_kickoff):
    # Keep the version otherwise valid: this must fail on season/date alone.
    version = replace(PLAYED,
                      first_available_at=bad_kickoff + timedelta(hours=3))
    with pytest.raises(DataError, match="kickoff outside declared"):
        select_result_as_of(
            (version,), kickoff_at=bad_kickoff,
            cutoff_at=datetime(bad_kickoff.year, bad_kickoff.month,
                               bad_kickoff.day, tzinfo=UTC) + timedelta(days=2),
            role="on_field_goals",
        )


def test_exceptional_2019_20_july_extension_is_not_rejected():
    kickoff = datetime(2020, 7, 22, 15, tzinfo=UTC)
    version = replace(
        PLAYED, season="2019/20",
        first_available_at=kickoff + timedelta(hours=3),
    )
    assert select_result_as_of(
        (version,), kickoff_at=kickoff,
        cutoff_at=datetime(2020, 7, 24, tzinfo=UTC),
        role="official_table",
    ) == version
