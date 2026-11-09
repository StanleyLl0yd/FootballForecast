"""M3 public/private seven-season membership histogram corroboration; no I/O.

Only aggregate private season-membership bitmasks are acceptable. These
histograms do not disclose or establish source-to-official club identities.
No match results, private IDs, model training or 2025/26 holdout is involved.
"""
from collections import Counter
from dataclasses import dataclass
from hashlib import sha256
from json import dumps
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_public_club_rosters import audit_public_roster_topology
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

PROTOCOL = "m3-development-only-membership-histogram-v1"
KIND = "M3_DEVELOPMENT_ONLY_PRIVATE_TEAM_MEMBERSHIP_HISTOGRAM"
SCOPE = "READ_ONLY_SELECT_FF_PRIVATE_SEVEN_DEVELOPMENT_SEASONS"
TABLES = [
    "ff_private.ff_rpl_history_snapshots",
    "ff_private.ff_rpl_history_matches",
]
LIMITATIONS = (
    "privateProviderIdsExported",
    "privateFixtureRowsExported",
    "matchGoalsRead",
    "individualClubNamesRead",
    "independentLegalIdentityVerified",
    "privateIdToPublicNameMapped",
    "playedScoreEligibilityProven",
    "historicalKickoffVerified",
    "originalPublicationTimesVerified",
    "sourceTrainingRightsVerified",
    "realTrainingAuthorized",
    "holdout2025_26Read",
)
EXPECTED_FIELDS = frozenset((
    "schemaVersion", "kind", "observedOn", "scope", "sourceTables",
    "region", "postgresMajor", "seasonsLeastToMostSignificant",
    "privateReadOnlyHistogram", "aggregateHistogramSha256",
    "aggregate", "limitations",
))


@dataclass(frozen=True, slots=True)
class MembershipHistogramAudit:
    protocol: str
    public_clubs: int
    private_clubs: int
    matching_histogram_groups: int
    singleton_profile_clubs: int
    ambiguous_profile_clubs: int
    all_seven_season_clubs: int
    aggregate_histogram_sha256: str
    private_identifiers_exported: bool = False
    verified_club_identity_mapping: bool = False
    played_goals_verified: bool = False
    real_training_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny(message: str) -> None:
    raise DataError("M3 membership histogram: " + message)


def _obj(value: object) -> dict:
    if type(value) is not dict:
        _deny("expected plain object")
    return value


def _integer(value: object, minimum: int, maximum: int) -> bool:
    return type(value) is int and minimum <= value <= maximum


def audit_membership_histogram(
    public_rosters: dict,
    private_provider_sample: dict,
    private_histogram_evidence: dict,
) -> MembershipHistogramAudit:
    """Compare all seven-year patterns, NOT private identity, goals or rights."""
    # Existing roster gate checks complete public seasons, names, provenance,
    # public topology, sampled private overlap, and all no-training guards.
    roster = audit_public_roster_topology(public_rosters, private_provider_sample)
    evidence = _obj(private_histogram_evidence)
    if set(evidence) != EXPECTED_FIELDS:
        _deny("unexpected evidence fields (possibly private data)")
    if (evidence["schemaVersion"] != 1 or type(evidence["schemaVersion"]) is not int
            or evidence["kind"] != KIND or evidence["observedOn"] != "2026-11-09"
            or evidence["scope"] != SCOPE or evidence["sourceTables"] != TABLES
            or evidence["region"] != "eu-central-1"
            or type(evidence["postgresMajor"]) is not int
            or evidence["postgresMajor"] != 17
            or evidence["seasonsLeastToMostSignificant"] != list(DEVELOPMENT_SEASONS)):
        _deny("private evidence scope, source or mask semantics changed")
    limits = _obj(evidence["limitations"])
    if set(limits) != set(LIMITATIONS) or any(
        limits[gate] is not False for gate in LIMITATIONS
    ):
        _deny("private disclosure, identity, training or holdout overclaim")

    masks: dict[str, int] = {}
    for i, item in enumerate(public_rosters["seasonReferences"]):
        for alias in item["publicNameAliasesInFinalTableOrder"]:
            masks[alias] = masks.get(alias, 0) | (1 << i)
    if len(masks) != roster.distinct_public_aliases:
        _deny("public alias count changed")
    public_counts = Counter(masks.values())

    raw = evidence["privateReadOnlyHistogram"]
    if type(raw) is not list or not 1 <= len(raw) <= 26:
        _deny("invalid aggregate histogram")
    pairs: list[list[int]] = []
    for entry in raw:
        row = _obj(entry)
        if (set(row) != {"mask", "clubCount"}
                or not _integer(row.get("mask"), 1, 127)
                or not _integer(row.get("clubCount"), 1, 26)):
            _deny("malformed mask or private count")
        pairs.append([row["mask"], row["clubCount"]])
    if pairs != sorted(pairs) or len(set(row[0] for row in pairs)) != len(pairs):
        _deny("non-canonical or duplicate mask groups")

    # This hash is ONLY over the public-safe aggregate histogram, never a
    # source-row fingerprint, proof of immutability, or privacy authorization.
    digest = sha256(dumps(pairs, separators=(",", ":")).encode("utf-8")).hexdigest()
    claimed = evidence["aggregateHistogramSha256"]
    if (type(claimed) is not str
            or fullmatch(r"[0-9a-f]{64}", claimed) is None
            or claimed != digest):
        _deny("aggregate histogram SHA-256 is inconsistent")
    private_counts = dict(pairs)
    if private_counts != dict(public_counts):
        _deny("full seven-year histograms differ; 26/82 totals alone are insufficient")

    clubs = sum(private_counts.values())
    appearances = sum(mask.bit_count() * count for mask, count in pairs)
    overlap = sum(
        count for mask, count in pairs for i in range(6)
        if mask & (1 << i) and mask & (1 << (i + 1))
    )
    singleton = sum(count for count in private_counts.values() if count == 1)
    ambiguous = clubs - singleton
    aggregate = _obj(evidence["aggregate"])
    expected = {
        "privateProviderClubCount": clubs,
        "privateClubSeasonAppearances": appearances,
        "distinctMembershipProfiles": len(pairs),
        "singletonProfileClubs": singleton,
        "ambiguousProfileClubs": ambiguous,
        "largestAmbiguityGroup": max(private_counts.values()),
        "clubsPresentEverySeason": private_counts.get(127, 0),
        "adjacentOverlapTotal": overlap,
    }
    if any(
        type(aggregate.get(key)) is not int or aggregate.get(key) != value
        for key, value in expected.items()
    ) or set(aggregate) != set(expected):
        _deny("claimed aggregate profile statistics disagree")
    if (clubs != 26 or appearances != 112 or overlap != roster.public_overlap_total
            or len(pairs) != 16 or singleton != 12 or ambiguous != 14):
        _deny("frozen seven-year reference topology changed")
    return MembershipHistogramAudit(
        protocol=PROTOCOL,
        public_clubs=len(masks),
        private_clubs=clubs,
        matching_histogram_groups=len(pairs),
        singleton_profile_clubs=singleton,
        ambiguous_profile_clubs=ambiguous,
        all_seven_season_clubs=private_counts[127],
        aggregate_histogram_sha256=digest,
    )
