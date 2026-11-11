"""M3 retrospective two-season date/direction graph, read-only pure comparator.

Links public fixture aliases to private source IDs using ONLY dated home/away
participation masks. Goals are compared AFTER identity mapping and cannot seed
club-identity guesses. Raw IDs and match-level data never leave this module.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_rsssf_match_schedule import PublicFixture

SEASONS = ("2021/22", "2022/23")
CLUB_RENAMES = {"Ahmat": "Akhmat", "NNovgorod": "Pari NN"}


@dataclass(frozen=True, slots=True)
class PrivateFixture:
    season: str
    kickoff_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int
    status: str


@dataclass(frozen=True, slots=True)
class SeasonCorrespondence:
    season: str
    public_fixtures: int
    private_fixtures: int
    independently_mapped_clubs: int
    date_direction_correspondences: int
    official_score_agreements: int
    official_score_disagreements: int
    revised_official_scores_excluded: int
    candidate_played_score_agreements: int
    completely_resolved: bool


@dataclass(frozen=True, slots=True)
class TwoSeasonCorrespondence:
    seasons: tuple[SeasonCorrespondence, ...]
    nominal_public_fixtures: int
    nominal_private_fixtures: int
    total_date_direction_correspondences: int
    candidate_played_score_agreements: int
    total_official_score_disagreements: int
    shared_clubs_between_seasons: int
    shared_clubs_with_stable_provider_id: int
    all_fixture_graphs_resolved: bool
    classification: str = "RETROSPECTIVE_STRUCTURAL_CANDIDATE_NOT_STRICT_AS_OF"
    real_training_authorized: bool = False
    sealed_holdout_read: bool = False
    private_ids_exported: bool = False
    source_modified: bool = False


def _deny(message: str) -> None:
    raise DataError("M3 two-season fixture graph: " + message)


def _private_valid(rows: tuple[PrivateFixture, ...]) -> None:
    if type(rows) is not tuple or len(rows) != 480:
        _deny("exactly 480 private development-only rows required")
    for m in rows:
        if type(m) is not PrivateFixture or m.season not in SEASONS:
            _deny("unexpected source season")
        if (type(m.kickoff_at) is not datetime
                or m.kickoff_at.tzinfo is None
                or m.kickoff_at.utcoffset() is None):
            _deny("invalid kickoff timezone")
        if m.kickoff_at.astimezone(UTC).year not in (2021, 2022, 2023):
            _deny("unexpected retrospective year")
        if (type(m.home_team_id) is not str or type(m.away_team_id) is not str
                or not 0 < len(m.home_team_id) <= 160
                or not 0 < len(m.away_team_id) <= 160
                or m.home_team_id == m.away_team_id
                or m.status != "finished"):
            _deny("malformed private source identity or status")
        if any(type(g) is not int or not 0 <= g <= 20
               for g in (m.home_goals, m.away_goals)):
            _deny("invalid private score")


def _public_valid(rows: tuple[PublicFixture, ...]) -> None:
    if type(rows) is not tuple or len(rows) != 480:
        _deny("exactly 480 public reference fixtures required")
    for m in rows:
        if type(m) is not PublicFixture or m.season not in SEASONS:
            _deny("invalid public fixture year")
        if m.home == m.away or not 1 <= m.round <= 30:
            _deny("public fixture identity invalid")


def _signatures(
    rows: tuple[PublicFixture, ...] | tuple[PrivateFixture, ...],
    public: bool,
) -> dict[str, tuple[tuple[str, str], ...]]:
    masks: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for row in rows:
        day = (row.day if public else row.kickoff_at.astimezone(UTC).date()).isoformat()
        home = row.home if public else row.home_team_id
        away = row.away if public else row.away_team_id
        masks[home].append((day, "H"))
        masks[away].append((day, "A"))
    return {club: tuple(sorted(days)) for club, days in masks.items()}


def audit_two_season_fixture_correspondence(
    public_rows: tuple[PublicFixture, ...],
    private_rows: tuple[PrivateFixture, ...],
) -> TwoSeasonCorrespondence:
    """Compare identities without goals, then compare paired official scores."""
    _private_valid(private_rows)
    _public_valid(public_rows)
    summaries: list[SeasonCorrespondence] = []
    full_links: dict[str, dict[str, str]] = {}
    for year in SEASONS:
        pub = tuple(row for row in public_rows if row.season == year)
        prv = tuple(row for row in private_rows if row.season == year)
        if len(pub) != 240 or len(prv) != 240:
            _deny("per-season 240+240 denominator changed")
        if len({(p.home, p.away) for p in pub}) != 240:
            _deny("repeated public directed fixture")
        if len({(p.home_team_id, p.away_team_id) for p in prv}) != 240:
            _deny("repeated private directed fixture")
        ps = _signatures(pub, True)
        qs = _signatures(prv, False)
        if len(ps) != 16 or len(qs) != 16:
            _deny("wrong club population")
        if any(len(mask) != 30 or sum(side == "H" for _, side in mask) != 15
               for mask in (*ps.values(), *qs.values())):
            _deny("incomplete home/away participation")
        by_mask: dict[tuple[tuple[str, str], ...], list[str]] = defaultdict(list)
        for club, mask in qs.items():
            by_mask[mask].append(club)
        links: dict[str, str] = {}
        for alias, mask in ps.items():
            found = by_mask.get(mask, [])
            if len(found) == 1:
                links[alias] = found[0]
        if len(set(links.values())) != len(links):
            _deny("non-bijective date-only mapping")
        full_links[year] = links
        private_by_key = {
            (row.kickoff_at.astimezone(UTC).date(), row.home_team_id,
             row.away_team_id): row for row in prv
        }
        if len(private_by_key) != 240:
            _deny("duplicate private calendar rows")
        correspondences = score_equal = score_wrong = revised = played = 0
        for row in pub:
            if row.home not in links or row.away not in links:
                continue
            match = private_by_key.get((row.day, links[row.home], links[row.away]))
            if match is None:
                continue
            correspondences += 1
            if (row.home_goals, row.away_goals) == (match.home_goals, match.away_goals):
                score_equal += 1
                if row.official_result_revised:
                    revised += 1
                else:
                    played += 1
            else:
                score_wrong += 1
        summaries.append(SeasonCorrespondence(
            season=year, public_fixtures=240, private_fixtures=240,
            independently_mapped_clubs=len(links),
            date_direction_correspondences=correspondences,
            official_score_agreements=score_equal,
            official_score_disagreements=score_wrong,
            revised_official_scores_excluded=revised,
            candidate_played_score_agreements=played,
            completely_resolved=(len(links) == 16 and correspondences == 240
                                 and score_equal == 240 and
                                 revised == int(year == "2022/23")),
        ))
    # Club-name equivalence is explicit: the renamed FC Nizhniy Novgorod and
    # the Ahmat/Akhmat transliteration share a stable *canonical public alias*.
    first = {CLUB_RENAMES.get(alias, alias): private_id
             for alias, private_id in full_links[SEASONS[0]].items()}
    second = {CLUB_RENAMES.get(alias, alias): private_id
              for alias, private_id in full_links[SEASONS[1]].items()}
    common = set(first) & set(second)
    return TwoSeasonCorrespondence(
        seasons=tuple(summaries),
        nominal_public_fixtures=480, nominal_private_fixtures=480,
        total_date_direction_correspondences=sum(x.date_direction_correspondences
                                                 for x in summaries),
        candidate_played_score_agreements=sum(x.candidate_played_score_agreements
                                              for x in summaries),
        total_official_score_disagreements=sum(x.official_score_disagreements
                                               for x in summaries),
        shared_clubs_between_seasons=len(common),
        shared_clubs_with_stable_provider_id=sum(first[k] == second[k] for k in common),
        all_fixture_graphs_resolved=all(x.completely_resolved for x in summaries),
    )
