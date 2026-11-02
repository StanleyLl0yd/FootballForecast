"""Research-only, private 2024/25 training input; no credentials, writes or fit.

The 2026 retrospective retrieval is only evidence that a final score was known
by retrieval time, not an actual final whistle or historical pre-match as-of.
"""
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from re import fullmatch
from typing import Protocol
from uuid import UUID

from football_forecast.data.contracts import DataError, aware

_START = datetime(2024, 7, 1, tzinfo=UTC)
_END = datetime(2025, 7, 1, tzinfo=UTC)
_QUERY = (
    "select source_match_id, season, dataset_role, kickoff_at, home_team_id, "
    "away_team_id, home_goals, away_goals, status, kickoff_time_confirmed, "
    "calendar_date_utc, published_at, source_sha256, retrieved_at "
    "from ff_private.ff_m2_training_rows(%s::uuid,%s::text)"
)


class ReadCursor(Protocol):
    def execute(self, statement: str, parameters: tuple[str, str]) -> object: ...
    def fetchmany(self, size: int) -> Sequence[tuple[object, ...]]: ...


@dataclass(frozen=True, slots=True)
class TrainingFixture:
    source_match_id: str
    kickoff_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int


@dataclass(frozen=True, slots=True)
class TrainingInput:
    snapshot_id: str
    source_sha256: str
    retrieved_at: datetime
    fixtures: tuple[TrainingFixture, ...]
    historical_prematch_verified: bool = False


def read_training_input(
    cursor: ReadCursor, *, snapshot_id: str, source_sha256: str
) -> TrainingInput:
    """Single parameterized private SELECT with a 241-row bound and double QC.

    The caller must supply an authorized, trusted private read cursor; this
    module never connects to the database or accesses the sealed-holdout rows.
    """
    try:
        if str(UUID(snapshot_id)) != snapshot_id:
            raise ValueError("noncanonical UUID")
    except (TypeError, ValueError, AttributeError) as exc:
        raise DataError("M2 training input: invalid snapshot identity") from exc
    if not isinstance(source_sha256, str) or not fullmatch(r"[a-f0-9]{64}", source_sha256):
        raise DataError("M2 training input: invalid source SHA-256")
    cursor.execute(_QUERY, (snapshot_id, source_sha256))
    rows = cursor.fetchmany(241)
    if len(rows) != 240:
        raise DataError("M2 training input: expected exactly 240 training rows")

    fixtures: list[TrainingFixture] = []
    retrieved_at: datetime | None = None
    for row in rows:
        if not isinstance(row, (tuple, list)) or len(row) != 14:
            raise DataError("M2 training input: invalid private row contract")
        (match_id, season, role, kickoff, home, away, gh, ga, status,
         confirmed, calendar_day, publication, sha, retrieved) = row
        if season != "2024/2025" or role != "train_baseline" or status != "finished":
            raise DataError("M2 training input: non-training season, role or result")
        if confirmed is not True or publication is not None or sha != source_sha256:
            raise DataError("M2 training input: unverified source provenance")
        aware(kickoff, "kickoff_at")
        aware(retrieved, "retrieved_at")
        if not _START <= kickoff < _END or kickoff >= retrieved or retrieved < _END:
            raise DataError("M2 training input: invalid chronology")
        if (type(calendar_day) is not date
                or calendar_day != kickoff.astimezone(UTC).date()):
            raise DataError("M2 training input: unconfirmed UTC fixture date")
        if retrieved_at is not None and retrieved != retrieved_at:
            raise DataError("M2 training input: mixed snapshot retrieval times")
        retrieved_at = retrieved
        if not all(isinstance(x, str) and 0 < len(x) <= 100 and x.strip()
                   for x in (match_id, home, away)) or home == away:
            raise DataError("M2 training input: invalid fixture identities")
        if any(type(x) is not int or not 0 <= x <= 20 for x in (gh, ga)):
            raise DataError("M2 training input: invalid played score")
        fixtures.append(TrainingFixture(match_id, kickoff, home, away, gh, ga))

    ids = [f.source_match_id for f in fixtures]
    directed = [(f.home_team_id, f.away_team_id) for f in fixtures]
    counts = Counter(t for f in fixtures for t in (f.home_team_id, f.away_team_id))
    if (len(set(ids)) != 240 or len(set(directed)) != 240
            or len(counts) != 16 or any(count != 30 for count in counts.values())):
        raise DataError("M2 training input: duplicate or incomplete fixtures")
    if fixtures != sorted(fixtures, key=lambda f: (f.kickoff_at, f.source_match_id)):
        raise DataError("M2 training input: unstable row ordering")
    assert retrieved_at is not None
    return TrainingInput(snapshot_id, source_sha256, retrieved_at, tuple(fixtures))
