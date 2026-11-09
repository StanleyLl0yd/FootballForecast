"""M3 public name-only RPL seven-season roster topology audit.

This pure module does not read database rows, provider names, private match
IDs, historical labels, models, or consumed 2025/26 holdout. Public aliases are
NOT verified identity mappings. Aggregate set topology is not a club crosswalk.
"""
from dataclasses import dataclass
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

PUBLIC_CLUB_ALIASES = frozenset({
    "akron", "akhmat", "anji", "arsenal_tula", "baltika", "cska",
    "dinamo_makhachkala", "dinamo_moscow", "enisey", "fakel",
    "khimki", "krasnodar", "krylia", "lokomotiv", "nizhny_novgorod",
    "orenburg", "rostov", "rotor", "rubin", "sochi", "spartak",
    "tambov", "torpedo", "ufa", "ural", "zenit",
})
FROZEN_ADJACENT_OVERLAPS = (14, 14, 14, 13, 14, 13)
PROTOCOL = "m3-retrospective-public-name-topology-v1"
NEGATIVE_GATES = (
    "privateDatabaseMatchRowsRead",
    "privateProviderIdsIncluded",
    "independentLegalClubContinuityVerified",
    "privateProviderIdToPublicNameApproved",
    "independentOriginalSourcePublicationTimesVerified",
    "officialPlayedGoalScoreCrosswalkVerified",
    "publicRosterAggregateEqualitiesEstablishPerFixtureIdentity",
    "realModelTrainingAuthorized",
    "sealed2025_26HoldoutRead",
    "publicForecastsWritten",
)


@dataclass(frozen=True, slots=True)
class PublicRosterAudit:
    season_count: int
    club_appearances: int
    distinct_public_aliases: int
    adjacent_public_alias_overlaps: tuple[int, ...]
    public_overlap_total: int
    private_sample_distinct_ids: int
    private_sample_overlap_total: int
    public_and_private_aggregate_shapes_coincide: bool
    protocol: str = PROTOCOL
    private_id_to_name_mapping_verified: bool = False
    official_legal_club_continuity_verified: bool = False
    first_publication_time_verified: bool = False
    real_training_authorized: bool = False
    sealed_holdout_read: bool = False
    private_rows_read: bool = False


def _deny(message: str) -> None:
    raise DataError("M3 public roster: " + message)


def _dict(value: object) -> dict:
    if type(value) is not dict:
        _deny("evidence must be a plain object")
    return value


def _count(value: object, expected: int) -> bool:
    return type(value) is int and value == expected


def audit_public_roster_topology(
    public_rosters: dict, private_identity_sample: dict,
) -> PublicRosterAudit:
    """A consistent public name topology is *only* a comparison candidate.

    A same-number 26/82 coincidence never grants legal identity correspondence,
    historical time authenticity, played-goal evidence, or an M3 real fit.
    """
    p = _dict(public_rosters)
    q = _dict(private_identity_sample)
    if (p.get("kind") != "M3_PUBLIC_RETROSPECTIVE_SEVEN_SEASON_ROSTER_NAME_CANDIDATE"
            or p.get("schemaVersion") != 1
            or q.get("kind") != "M2_RPL_SEVEN_SEASON_TEAM_IDENTITY_SAMPLE"):
        _deny("unexpected public or private metadata kind")
    limits = _dict(p.get("limitations"))
    if any(limits.get(gate) is not False for gate in NEGATIVE_GATES):
        _deny("unauthorized source identity or real training assertion")
    years = p.get("seasonReferences")
    if type(years) is not list or len(years) != 7:
        _deny("must contain exactly seven development-only public seasons")
    sets = []
    for i, item in enumerate(years):
        r = _dict(item)
        season = DEVELOPMENT_SEASONS[i]
        expected_url = f"https://www.rsssf.org/tablesr/rus{int(season[:4])+1}.html"
        if season == "2023/24":
            expected_url = expected_url.replace("www.", "")
        clubs = r.get("publicNameAliasesInFinalTableOrder")
        if (r.get("season") != season or r.get("sourcePage") != expected_url
                or not _count(r.get("leagueGamesPerClubReported"), 30)
                or type(clubs) is not list or len(clubs) != 16
                or any(type(c) is not str
                       or fullmatch(r"[a-z][a-z0-9_]{1,60}", c) is None
                       for c in clubs)
                or len(set(clubs)) != 16):
            _deny("public roster season, source, or alias cardinality differs")
        sets.append(frozenset(clubs))
    public_clubs = frozenset().union(*sets)
    overlaps = tuple(len(sets[i] & sets[i + 1]) for i in range(6))
    if public_clubs != PUBLIC_CLUB_ALIASES or overlaps != FROZEN_ADJACENT_OVERLAPS:
        _deny("unexpected public club roster continuity topology")
    aggregate = _dict(p.get("aggregate"))
    expected_public = {
        "leagueSeasons": 7,
        "clubAppearances": 112,
        "uniquePublicNameAliases": 26,
        "adjacentSeasonSharedPublicNameAliases": list(FROZEN_ADJACENT_OVERLAPS),
        "totalAdjacentSharedPublicNameAliases": 82,
        "privateProviderSourceSampleUniqueIds": 26,
        "privateProviderSourceSampleAdjacentSharedIds": 82,
    }
    if aggregate != expected_public:
        _deny("inconsistent claimed public or private topology counts")
    if (not _count(q.get("observedUniqueClubIds"), 26)
            or not _count(q.get("totalSharedAdjacentClubIdInstances"), 82)
            or _dict(q.get("limitations")).get(
                "independentClubIdentityMappingAccepted"
            ) is not False):
        _deny("same-provider sample cannot establish independent identity")
    sample = q.get("consecutiveOverlaps")
    if type(sample) is not list or len(sample) != 6:
        _deny("missing same-provider adjacent season samples")
    for i, row in enumerate(sample):
        r = _dict(row)
        if (r.get("earlierSeason") != DEVELOPMENT_SEASONS[i]
                or r.get("laterSeason") != DEVELOPMENT_SEASONS[i + 1]
                or not _count(r.get("sharedIds"), FROZEN_ADJACENT_OVERLAPS[i])
                or r.get("pinnedPrivateOverlapMatches") is not True):
            _deny("provider sample is not independently cross-mapped")
    return PublicRosterAudit(
        season_count=7,
        club_appearances=112,
        distinct_public_aliases=26,
        adjacent_public_alias_overlaps=overlaps,
        public_overlap_total=82,
        private_sample_distinct_ids=26,
        private_sample_overlap_total=82,
        public_and_private_aggregate_shapes_coincide=True,
    )
