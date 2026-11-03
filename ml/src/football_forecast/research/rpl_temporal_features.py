"""Leakage-conservative development-only RPL features.

Retrospectively collected match results are not authenticated publisher
pre-match observations. Never claim strict historical as-of or evaluate holdout.
"""
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from itertools import groupby

from football_forecast.data.contracts import DataError

DEVELOPMENT_SEASONS = tuple(f"{year}/{(year + 1) % 100:02d}" for year in range(2018, 2025))
RECENT_MATCHES = 5
CLASSIFICATION = "NON_STRICT_RETROSPECTIVE"


@dataclass(frozen=True, slots=True)
class DevelopmentMatch:
    season: str
    source_match_id: str
    kickoff_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int
    status: str = "finished"


@dataclass(frozen=True, slots=True)
class PregameFeatures:
    season: str
    match_id: str
    kickoff_at: datetime
    information_cutoff: datetime
    home_prior_matches: int
    away_prior_matches: int
    home_prior_home_matches: int
    away_prior_away_matches: int
    home_recent_count: int
    away_recent_count: int
    home_recent_goals_for: int
    home_recent_goals_against: int
    away_recent_goals_for: int
    away_recent_goals_against: int
    home_rest_days: int | None
    away_rest_days: int | None
    home_unseen: bool
    away_unseen: bool
    research_classification: str = CLASSIFICATION


@dataclass(slots=True)
class _History:
    total_matches: int = 0
    home_matches: int = 0
    away_matches: int = 0
    last_match_day: date | None = None
    recent: deque[tuple[int, int]] = field(
        default_factory=lambda: deque(maxlen=RECENT_MATCHES)
    )


def _validated(fixtures: tuple[DevelopmentMatch, ...]) -> tuple[DevelopmentMatch, ...]:
    if not fixtures or len(fixtures) > 1680:
        raise DataError("RPL features: empty or oversized development cohort")
    seen_ids: set[tuple[str, str]] = set()
    seen_pairs: set[tuple[str, str, str]] = set()
    for item in fixtures:
        if not isinstance(item, DevelopmentMatch) or item.season not in DEVELOPMENT_SEASONS:
            raise DataError("RPL features: non-development season or source record")
        if (not all(isinstance(x, str) and 0 < len(x) <= 160 and x.strip()
                    for x in (item.source_match_id, item.home_team_id, item.away_team_id))
                or item.home_team_id == item.away_team_id or item.status != "finished"):
            raise DataError("RPL features: invalid identity or status")
        if (not isinstance(item.kickoff_at, datetime)
                or item.kickoff_at.tzinfo is None
                or item.kickoff_at.utcoffset() is None
                or item.kickoff_at.utcoffset().total_seconds() != 0):
            raise DataError("RPL features: explicit UTC kickoff required")
        if any(type(n) is not int or n < 0 or n > 20
               for n in (item.home_goals, item.away_goals)):
            raise DataError("RPL features: invalid final score")
        year = int(item.season[:4])
        start = datetime(year, 7, 1, tzinfo=UTC)
        stop = datetime(2020, 8, 1, tzinfo=UTC) if item.season == "2019/20" else (
            datetime(year + 1, 7, 1, tzinfo=UTC)
        )
        if not start <= item.kickoff_at < stop:
            raise DataError("RPL features: kickoff outside declared season")
        key = (item.season, item.source_match_id)
        pair = (item.season, item.home_team_id, item.away_team_id)
        if key in seen_ids or pair in seen_pairs:
            raise DataError("RPL features: repeated ID or directed fixture")
        seen_ids.add(key)
        seen_pairs.add(pair)
    return tuple(sorted(fixtures, key=lambda m: (
        m.kickoff_at, m.season, m.source_match_id
    )))


def build_development_features(
    fixtures: tuple[DevelopmentMatch, ...],
) -> tuple[PregameFeatures, ...]:
    """Only earlier UTC-day matches; never same-day or future outcomes.

    Club identities are season-scoped until longitudinal aliases are proven.
    No network, database, training, predictions, labels in output or evaluation.
    """
    ordered = _validated(fixtures)
    histories: dict[tuple[str, str], _History] = defaultdict(_History)
    snapshots: list[PregameFeatures] = []

    def snapshot(m: DevelopmentMatch, day: date) -> PregameFeatures:
        home = histories[(m.season, m.home_team_id)]
        away = histories[(m.season, m.away_team_id)]
        cutoff = datetime(day.year, day.month, day.day, tzinfo=UTC)

        def rest(h: _History) -> int | None:
            return (day - h.last_match_day).days if h.last_match_day else None

        return PregameFeatures(
            season=m.season, match_id=m.source_match_id, kickoff_at=m.kickoff_at,
            information_cutoff=cutoff,
            home_prior_matches=home.total_matches, away_prior_matches=away.total_matches,
            home_prior_home_matches=home.home_matches,
            away_prior_away_matches=away.away_matches,
            home_recent_count=len(home.recent), away_recent_count=len(away.recent),
            home_recent_goals_for=sum(gf for gf, _ in home.recent),
            home_recent_goals_against=sum(ga for _, ga in home.recent),
            away_recent_goals_for=sum(gf for gf, _ in away.recent),
            away_recent_goals_against=sum(ga for _, ga in away.recent),
            home_rest_days=rest(home), away_rest_days=rest(away),
            home_unseen=home.total_matches == 0, away_unseen=away.total_matches == 0,
        )

    # Same-day matches share the same pre-day state. Apply outcomes afterward.
    for day, matching in groupby(ordered, key=lambda m: m.kickoff_at.date()):
        group = tuple(matching)
        snapshots.extend(snapshot(m, day) for m in group)
        for m in group:
            home = histories[(m.season, m.home_team_id)]
            away = histories[(m.season, m.away_team_id)]
            home.total_matches += 1
            home.home_matches += 1
            home.last_match_day = day
            home.recent.append((m.home_goals, m.away_goals))
            away.total_matches += 1
            away.away_matches += 1
            away.last_match_day = day
            away.recent.append((m.away_goals, m.home_goals))
    return tuple(snapshots)
