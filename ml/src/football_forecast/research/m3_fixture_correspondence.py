"""M3 per-fixture cross-source disagreement triage; synthetic-tested, no I/O.

This algorithm is a private-runner building block, NOT evidence of source
independence, match truth, source rights or permission to fit any real model.
Its output is aggregate-only. It must never return private fixture identifiers,
scores, names or fitted parameters. The consumed 2025/26 holdout is forbidden.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import (
    CLASSIFICATION,
    DEVELOPMENT_SEASONS,
    development_season_bounds,
)

RESEARCH_PROTOCOL = "m3-seven-year-independent-fixture-triage-v1"
REFERENCE_SOURCES = frozenset((
    "openfootball-europe-pinned",
    "openfootball-json-pinned",
    "rsssf-retrospective-pinned",
    "rfs-official-archive-pinned",
))
REFERENCE_KINDS = frozenset(("played", "technical_award", "revised_official", "unclassified"))
REASONS = (
    "CANDIDATE_PLAYED_AGREEMENT",
    "IDENTITY_UNMAPPED",
    "REFERENCE_MISSING",
    "REFERENCE_AMBIGUOUS",
    "HOME_AWAY_CONFLICT",
    "DATE_CONFLICT",
    "TECHNICAL_RESULT",
    "REVISED_OFFICIAL_RESULT",
    "STATUS_UNCLASSIFIED",
    "SCORE_UNVERIFIED",
    "SCORE_CONFLICT",
)


@dataclass(frozen=True, slots=True)
class PrivateDevelopmentFixture:
    season: str
    private_id: str
    home_team_id: str
    away_team_id: str
    kickoff_utc: datetime
    home_goals: int
    away_goals: int
    status: str = "finished"


@dataclass(frozen=True, slots=True)
class IndependentReferenceFixture:
    season: str
    reference_id: str
    home_club: str
    away_club: str
    event_day_utc: date
    result_kind: str
    home_played_goals: int | None
    away_played_goals: int | None
    source_namespace: str
    source_content_sha256: str


@dataclass(frozen=True, slots=True)
class DeclaredSeasonClubLink:
    season: str
    private_team_id: str
    independent_club: str


@dataclass(frozen=True, slots=True)
class FixtureTriageSeason:
    season: str
    private_fixture_count: int
    public_reference_fixture_count: int
    outcome_counts: tuple[tuple[str, int], ...]
    independently_eligible_private_rows: int = 0


@dataclass(frozen=True, slots=True)
class FixtureTriageReport:
    protocol: str
    seasons: tuple[FixtureTriageSeason, ...]
    private_fixture_count: int
    public_reference_fixture_count: int
    candidate_played_agreements: int
    ambiguous_or_rejected: int
    independently_eligible_private_rows: int = 0
    real_training_authorized: bool = False
    heldout_2025_26_read: bool = False
    model_fitted: bool = False
    raw_identifiers_exposed: bool = False
    classification: str = CLASSIFICATION


def _fail(reason: str) -> None:
    raise DataError("M3 fixture triage: " + reason)


def _identity(value: object) -> bool:
    return (type(value) is str and 1 <= len(value) <= 160
            and value.strip() == value and bool(value)
            and all(32 <= ord(c) != 127 for c in value))


def _utc(value: object) -> bool:
    return (type(value) is datetime and value.tzinfo is not None
            and value.utcoffset() is not None
            and value.utcoffset() == timedelta(0))


def _goal(value: object) -> bool:
    return type(value) is int and 0 <= value <= 20


def _match_day(season: str, day: date) -> bool:
    start, stop = development_season_bounds(season)
    return start.date() <= day < stop.date()


def audit_independent_fixture_candidates(
    private: tuple[PrivateDevelopmentFixture, ...],
    references: tuple[IndependentReferenceFixture, ...],
    declared_club_links: tuple[DeclaredSeasonClubLink, ...],
) -> FixtureTriageReport:
    """Compare explicit *declared* identity links without inferring new mappings.

    Scores, result status and UTC dates must match independently *before*
    assigning CANDIDATE_PLAYED_AGREEMENT. Even agreement does NOT establish
    legal provenance, authentic first-publication time or training eligibility.
    A future approved private runner may use these reason counts, never the
    underlying records, for research review and source-quality decisions.
    """
    if any(type(items) is not tuple for items in (private, references, declared_club_links)):
        _fail("closed tuple input required")
    if not 1 <= len(private) <= 1680 or len(references) > 1680 or len(declared_club_links) > 112:
        _fail("development-only resource envelope exceeded")
    per_year: dict[str, list[PrivateDevelopmentFixture]] = defaultdict(list)
    private_ids: set[tuple[str, str]] = set()
    private_pairs: set[tuple[str, str, str]] = set()
    for row in private:
        if (type(row) is not PrivateDevelopmentFixture or row.season not in DEVELOPMENT_SEASONS
                or not all(_identity(v) for v in (
                    row.private_id, row.home_team_id, row.away_team_id
                ))
                or row.home_team_id == row.away_team_id or row.status != "finished"
                or not _utc(row.kickoff_utc)
                or not _goal(row.home_goals) or not _goal(row.away_goals)):
            _fail("invalid private development fixture, time or played-status assertion")
        start, stop = development_season_bounds(row.season)
        if not start <= row.kickoff_utc < stop:
            _fail("private fixture outside development season")
        key = (row.season, row.private_id)
        directed = (row.season, row.home_team_id, row.away_team_id)
        if key in private_ids or directed in private_pairs:
            _fail("duplicate private fixture or directed pair")
        private_ids.add(key)
        private_pairs.add(directed)
        per_year[row.season].append(row)
        if len(per_year[row.season]) > 240:
            _fail("more than 240 private fixtures in development season")

    links: dict[tuple[str, str], str] = {}
    reverse_links: set[tuple[str, str]] = set()
    for item in declared_club_links:
        if (type(item) is not DeclaredSeasonClubLink
                or item.season not in DEVELOPMENT_SEASONS
                or not _identity(item.private_team_id)
                or not _identity(item.independent_club)):
            _fail("untrusted or unbounded club link")
        key = (item.season, item.private_team_id)
        inverse = (item.season, item.independent_club)
        if key in links or inverse in reverse_links:
            _fail("non-bijective, duplicate or conflicting independent club identity")
        links[key] = item.independent_club
        reverse_links.add(inverse)
    if any(len([key for key in links if key[0] == season]) > 16
           for season in DEVELOPMENT_SEASONS):
        _fail("more than sixteen mapped clubs in a season")

    by_exact: dict[tuple[str, str, str, date], list[IndependentReferenceFixture]] = (
        defaultdict(list)
    )
    by_pair: dict[tuple[str, str, str], list[IndependentReferenceFixture]] = (
        defaultdict(list)
    )
    ref_years: Counter[str] = Counter()
    reference_ids: set[tuple[str, str, str]] = set()
    for ref in references:
        if (type(ref) is not IndependentReferenceFixture
                or ref.season not in DEVELOPMENT_SEASONS
                or not all(_identity(v) for v in (
                    ref.reference_id, ref.home_club, ref.away_club
                ))
                or ref.home_club == ref.away_club
                or type(ref.event_day_utc) is not date
                or not _match_day(ref.season, ref.event_day_utc)
                or type(ref.result_kind) is not str
                or ref.result_kind not in REFERENCE_KINDS
                or type(ref.source_namespace) is not str
                or ref.source_namespace not in REFERENCE_SOURCES
                or type(ref.source_content_sha256) is not str
                or fullmatch(r"[a-f0-9]{64}", ref.source_content_sha256) is None
                or (ref.home_played_goals is not None and not _goal(ref.home_played_goals))
                or (ref.away_played_goals is not None and not _goal(ref.away_played_goals))):
            _fail("untrusted independent reference format, scope or provenance digest")
        if ref.result_kind != "played" and (
            ref.home_played_goals is not None or ref.away_played_goals is not None
        ):
            _fail("technical or revised scores cannot be disguised as played goals")
        ref_id = (ref.season, ref.source_namespace, ref.reference_id)
        if ref_id in reference_ids:
            _fail("repeated reference ID")
        reference_ids.add(ref_id)
        ref_years[ref.season] += 1
        if ref_years[ref.season] > 240:
            _fail("more than 240 independent references in development season")
        by_exact[(ref.season, ref.home_club, ref.away_club, ref.event_day_utc)].append(ref)
        by_pair[(ref.season, ref.home_club, ref.away_club)].append(ref)

    results: list[FixtureTriageSeason] = []
    candidate_total = 0
    for season in DEVELOPMENT_SEASONS:
        tallies: Counter[str] = Counter()
        for row in per_year[season]:
            home = links.get((season, row.home_team_id))
            away = links.get((season, row.away_team_id))
            if home is None or away is None:
                reason = "IDENTITY_UNMAPPED"
            else:
                day = row.kickoff_utc.date()
                exact = by_exact.get((season, home, away, day), ())
                directed = by_pair.get((season, home, away), ())
                swapped = by_exact.get((season, away, home, day), ())
                if len(exact) > 1 or len(directed) > 1:
                    reason = "REFERENCE_AMBIGUOUS"
                elif len(exact) == 1:
                    reference = exact[0]
                    if reference.result_kind == "technical_award":
                        reason = "TECHNICAL_RESULT"
                    elif reference.result_kind == "revised_official":
                        reason = "REVISED_OFFICIAL_RESULT"
                    elif reference.result_kind != "played":
                        reason = "STATUS_UNCLASSIFIED"
                    elif (reference.home_played_goals is None
                          or reference.away_played_goals is None):
                        reason = "SCORE_UNVERIFIED"
                    elif (reference.home_played_goals != row.home_goals
                          or reference.away_played_goals != row.away_goals):
                        reason = "SCORE_CONFLICT"
                    else:
                        reason = "CANDIDATE_PLAYED_AGREEMENT"
                elif swapped:
                    reason = "HOME_AWAY_CONFLICT"
                elif directed:
                    reason = "DATE_CONFLICT"
                else:
                    reason = "REFERENCE_MISSING"
            tallies[reason] += 1
        count = len(per_year[season])
        if sum(tallies.values()) != count:
            _fail("fixture classification denominator corrupted")
        candidate_total += tallies["CANDIDATE_PLAYED_AGREEMENT"]
        results.append(FixtureTriageSeason(
            season=season,
            private_fixture_count=count,
            public_reference_fixture_count=ref_years[season],
            outcome_counts=tuple((reason, tallies[reason]) for reason in REASONS),
        ))
    return FixtureTriageReport(
        protocol=RESEARCH_PROTOCOL,
        seasons=tuple(results),
        private_fixture_count=len(private),
        public_reference_fixture_count=len(references),
        candidate_played_agreements=candidate_total,
        ambiguous_or_rejected=len(private) - candidate_total,
    )
