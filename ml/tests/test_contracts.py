from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import (
    DataError,
    FinishedMatch,
    MatchStatus,
    SourceObservation,
)

T = datetime(2025, 9, 1, tzinfo=UTC)


def test_strict_historical_requires_publication_and_ingestion() -> None:
    record = SourceObservation(
        'vendor', '321', T, T + timedelta(hours=2), T + timedelta(hours=3), 'v1'
    )
    assert not record.eligible(T + timedelta(hours=2, minutes=30))
    assert record.eligible(T + timedelta(hours=3))
    assert not record.eligible(T + timedelta(hours=1))


def test_ingestion_cannot_stand_in_for_historical_publication() -> None:
    record = SourceObservation('vendor', '321', T, None, T + timedelta(days=10), 'v1')
    assert not record.eligible(T + timedelta(days=11))
    assert record.eligible(T + timedelta(days=11), strict_historical=False)


def test_naive_timestamps_are_rejected() -> None:
    with pytest.raises(DataError):
        SourceObservation('vendor', 'a', T.replace(tzinfo=None), T, T, 'v1')


@pytest.mark.parametrize('field', ['event_at', 'published_at', 'ingested_at'])
def test_datetime_type_errors_are_data_errors(field: str) -> None:
    values = {'event_at': T, 'published_at': T, 'ingested_at': T}
    values[field] = '2025-09-01T00:00:00Z'
    with pytest.raises(DataError):
        SourceObservation('vendor', 'a', values['event_at'],
                          values['published_at'], values['ingested_at'], 'v1')


def test_publication_cannot_follow_ingestion() -> None:
    with pytest.raises(DataError):
        SourceObservation('vendor', 'a', T, T + timedelta(days=1), T, 'v1')


def test_match_not_usable_before_final_whistle() -> None:
    match = FinishedMatch('m', T, T + timedelta(hours=2), 'h', 'a', 2, 1)
    assert not match.usable(T + timedelta(hours=1))
    assert match.usable(T + timedelta(hours=2))


def test_awarded_match_requires_separate_policy() -> None:
    with pytest.raises(DataError):
        FinishedMatch('m', T, T + timedelta(hours=2), 'h', 'a', 2, 0, MatchStatus.AWARDED)


@pytest.mark.parametrize(
    'match_id,home_id,away_id',
    [
        ('', 'h', 'a'), ('  ', 'h', 'a'), ('m', '', 'a'),
        ('m', 'h', ' '), ('m', 'h', 'h'), (None, 'h', 'a'), ('m', 5, 'a'),
    ],
)
def test_invalid_match_identifiers_rejected(match_id, home_id, away_id) -> None:
    with pytest.raises(DataError):
        FinishedMatch(match_id, T, T + timedelta(hours=2), home_id, away_id, 1, 0)


def test_bad_goals_rejected() -> None:
    for goals in (-1, 1.5, True, None):
        with pytest.raises(DataError):
            FinishedMatch('m', T, T + timedelta(hours=2), 'h', 'a', goals, 0)
