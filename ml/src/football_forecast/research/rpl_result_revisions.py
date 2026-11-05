"""Pure, synthetic-tested revision timeline guard; no real source ingestion or scoring."""
from dataclasses import dataclass
from datetime import datetime, time

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

ROLES = ("official_table", "on_field_goals")
KINDS = ("played", "awarded")


@dataclass(frozen=True, slots=True)
class ResultVersion:
    season: str
    source_match_id: str
    kind: str
    home_goals: int
    away_goals: int
    first_available_at: datetime | None
    original_availability_verified: bool = False


def _utc(value: object) -> bool:
    return (isinstance(value, datetime) and value.tzinfo is not None
            and value.utcoffset() is not None
            and value.utcoffset().total_seconds() == 0)


def select_result_as_of(
    versions: tuple[ResultVersion, ...],
    *,
    kickoff_at: datetime,
    cutoff_at: datetime,
    role: str,
) -> ResultVersion | None:
    """Use latest eligible official result, or most recent actually played goals.

    The caller's verification assertion is not proof of real historical issuance.
    A real source and first-serving timeline require independent review.
    """
    if (type(versions) is not tuple or not 1 <= len(versions) <= 8
            or not all(isinstance(v, ResultVersion) for v in versions)
            or role not in ROLES or not _utc(kickoff_at) or not _utc(cutoff_at)
            or cutoff_at.time() != time.min):
        raise DataError("RPL revisions: invalid timeline, role or UTC midnight cutoff")
    first = versions[0]
    if (first.season not in DEVELOPMENT_SEASONS
            or not isinstance(first.source_match_id, str)
            or not 0 < len(first.source_match_id) <= 160
            or not first.source_match_id.strip()):
        raise DataError("RPL revisions: unapproved season or match identity")

    previous: datetime | None = None
    for version in versions:
        available = version.first_available_at
        if (version.season != first.season
                or version.source_match_id != first.source_match_id
                or version.kind not in KINDS
                or any(type(g) is not int or not 0 <= g <= 20
                       for g in (version.home_goals, version.away_goals))
                or version.original_availability_verified is not True
                or not _utc(available)
                or available <= kickoff_at
                or (previous is not None and available <= previous)):
            raise DataError("RPL revisions: unverified or conflicting result version")
        previous = available

    eligible = tuple(v for v in versions if v.first_available_at <= cutoff_at
                     and (role == "official_table" or v.kind == "played"))
    return eligible[-1] if eligible else None
