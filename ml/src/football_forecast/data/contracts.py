"""Source and as-of contracts. All datetimes must be timezone-aware UTC/offsets."""
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class DataError(ValueError):
    """A source record fails provenance or chronological validation."""


class MatchStatus(StrEnum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"
    AWARDED = "awarded"


def aware(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise DataError(f"{field} must have an explicit timezone")


@dataclass(frozen=True, slots=True)
class SourceObservation:
    """Provenance metadata, not proof of when a historical fact was published."""
    source_id: str
    external_id: str
    event_at: datetime
    published_at: datetime | None
    ingested_at: datetime
    version: str

    def __post_init__(self) -> None:
        if not self.source_id.strip() or not self.external_id.strip() or not self.version.strip():
            raise DataError("source identity and version are mandatory")
        aware(self.event_at, "event_at")
        aware(self.ingested_at, "ingested_at")
        if self.published_at is not None:
            aware(self.published_at, "published_at")
            if self.published_at > self.ingested_at:
                raise DataError("publication cannot be later than ingestion")

    def eligible(self, as_of: datetime, *, strict_historical: bool = True) -> bool:
        """Strict retrospective tests exclude records lacking true publication timestamps.

        Ingestion is not an acceptable historical substitute for publication time.
        """
        aware(as_of, "as_of")
        if strict_historical and self.published_at is None:
            return False
        if self.published_at is not None:
            return self.published_at <= as_of and self.ingested_at <= as_of
        return self.ingested_at <= as_of


@dataclass(frozen=True, slots=True)
class FinishedMatch:
    match_id: str
    kickoff_at: datetime
    finished_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int
    status: MatchStatus = MatchStatus.FINISHED

    def __post_init__(self) -> None:
        aware(self.kickoff_at, "kickoff_at")
        aware(self.finished_at, "finished_at")
        if self.finished_at < self.kickoff_at:
            raise DataError("match cannot finish before kickoff")
        if not all(
            isinstance(value, str) and value.strip()
            for value in (self.match_id, self.home_team_id, self.away_team_id)
        ):
            raise DataError("match and team identities must be nonempty strings")
        if self.home_team_id == self.away_team_id:
            raise DataError("same team on both sides")
        if self.status != MatchStatus.FINISHED:
            raise DataError("technical results require a separate policy")
        if not all(
            isinstance(g, int) and not isinstance(g, bool)
            for g in (self.home_goals, self.away_goals)
        ):
            raise DataError("goals must be integers")
        if self.home_goals < 0 or self.away_goals < 0:
            raise DataError("goals cannot be negative")

    def usable(self, as_of: datetime) -> bool:
        aware(as_of, "as_of")
        return self.finished_at <= as_of
