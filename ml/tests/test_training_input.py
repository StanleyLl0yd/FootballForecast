from datetime import UTC, date, datetime, timedelta
from uuid import UUID

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.data.training_input import read_training_input

SNAPSHOT = str(UUID("a0000000-0000-0000-0000-000000000001"))
SHA = "a" * 64
RETRIEVED = datetime(2026, 10, 29, tzinfo=UTC)
START = datetime(2024, 8, 1, 12, tzinfo=UTC)


def synthetic_rows():
    rows = []
    for hi in range(16):
        for ai in range(16):
            if hi == ai:
                continue
            kickoff = START + timedelta(days=len(rows) // 5)
            rows.append((
                f"synthetic-{hi}-{ai}", "2024/2025", "train_baseline", kickoff,
                f"club-{hi}", f"club-{ai}", 2, 1, "finished", True,
                kickoff.date(), None, SHA, RETRIEVED,
            ))
    return sorted(rows, key=lambda row: (row[3], row[0]))


class SyntheticCursor:
    def __init__(self, rows):
        self.rows = rows
        self.sql = None
        self.parameters = None

    def execute(self, sql, parameters):
        self.sql, self.parameters = sql, parameters

    def fetchmany(self, size):
        assert size == 241
        return self.rows[:size]


def load(rows=None):
    cursor = SyntheticCursor(synthetic_rows() if rows is None else rows)
    result = read_training_input(cursor, snapshot_id=SNAPSHOT, source_sha256=SHA)
    assert cursor.parameters == (SNAPSHOT, SHA)
    assert cursor.sql.lower().startswith("select ")
    assert "ff_private.ff_m2_training_rows" in cursor.sql
    assert not any(word in cursor.sql.lower() for word in ("insert ", "update ", "delete "))
    return result


def test_pinned_private_training_only_reproducible():
    result = load()
    assert len(result.fixtures) == 240
    assert result.source_sha256 == SHA
    assert result.retrieved_at == RETRIEVED
    assert not result.historical_prematch_verified
    assert result.fixtures == load().fixtures
    assert not hasattr(result.fixtures[0], "finished_at")


@pytest.mark.parametrize(
    "field, value",
    [
        (1, "2025/2026"), (2, "sealed_holdout"), (2, "current"),
        (7, -1), (7, 21), (7, True), (8, "awarded"), (9, False),
        (11, datetime(2024, 8, 1, tzinfo=UTC)), (12, "b" * 64),
        (13, datetime(2026, 10, 28, tzinfo=UTC)),
        (3, datetime(2025, 8, 1, tzinfo=UTC)),
        (3, datetime(2024, 8, 1)),
        (4, "club-1"), (10, date(2024, 8, 2)),
    ],
)
def test_reject_bad_role_provenance_score_identity_or_chronology(field, value):
    rows = synthetic_rows()
    item = list(rows[0])
    item[field] = value
    rows[0] = tuple(item)
    with pytest.raises(DataError):
        load(rows)


def test_reject_non_unique_incomplete_and_overlarge():
    rows = synthetic_rows()
    for invalid in (rows[:239], rows + [rows[0]], [rows[0], *rows[1:239], rows[0]]):
        with pytest.raises(DataError):
            load(invalid)
    other = rows.copy()
    changed = list(other[1])
    changed[0] = other[0][0]
    other[1] = tuple(changed)
    with pytest.raises(DataError, match="duplicate"):
        load(other)


def test_reject_unstable_order_and_mixed_snapshot_time():
    rows = synthetic_rows()
    with pytest.raises(DataError, match="ordering"):
        load(list(reversed(rows)))
    changed = list(rows[0])
    changed[13] = RETRIEVED + timedelta(minutes=1)
    rows[0] = tuple(changed)
    with pytest.raises(DataError, match="mixed snapshot"):
        load(rows)


def test_bad_query_identity_fails_before_database_access():
    for snapshot, sha in (("bogus", SHA), (SNAPSHOT, "X" * 64), (SNAPSHOT, "")):
        cursor = SyntheticCursor(synthetic_rows())
        with pytest.raises(DataError):
            read_training_input(cursor, snapshot_id=snapshot, source_sha256=sha)
        assert cursor.sql is None


def test_read_batch_is_immutable_and_no_hidden_holdout():
    dataset = load()
    with pytest.raises(AttributeError):
        dataset.snapshot_id = SNAPSHOT
    with pytest.raises(AttributeError):
        dataset.fixtures[0].away_goals = 4
    assert not any("2025/2026" in f.source_match_id for f in dataset.fixtures)
