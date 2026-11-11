"""M4 deterministic private shadow-candidate model, never a public forecast.

Fits the exact eligible, previously accepted NON_STRICT_RETROSPECTIVE
2018/19–2024/25 development cohort. A trusted owner runner must independently
attest input source; pure shape validation does not certify real source truth.
No I/O, 2025/26 data, hyperparameter tuning or public model approval.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass
from hashlib import sha256
from json import dumps, loads
from math import isfinite

from football_forecast.data.contracts import DataError
from football_forecast.models.poisson import ScoreDistribution, poisson_score_distribution
from football_forecast.research.m3_synthetic_team_poisson import (
    AWAY_GOALS_PRIOR,
    HOME_GOALS_PRIOR,
    LEAGUE_PRIOR_MATCHES,
    MAX_RATE,
    MIN_RATE,
    TEAM_PSEUDO_MATCHES,
)
from football_forecast.research.rpl_temporal_features import (
    CLASSIFICATION,
    DEVELOPMENT_SEASONS,
    DevelopmentMatch,
    build_development_features,
)

MODEL_VERSION = "m4-team-poisson-shrink12-shadow-v1"
EXPECTED_COUNTS = (240, 236, 238, 240, 239, 240, 240)
EXPECTED_CLUBS = 26
SHA_HEX = set("0123456789abcdef")


@dataclass(frozen=True, slots=True)
class SourceSnapshot:
    season: str
    source_sha256: str
    normalized_sha256: str


@dataclass(frozen=True, slots=True)
class PrivateCandidate:
    """Never serialize or print this object in Actions or a web response."""

    artifact_bytes: bytes
    artifact_sha256: str
    source_manifest_sha256: str
    eligible_rows_sha256: str
    eligible_matches: int
    distinct_clubs: int
    model_version: str = MODEL_VERSION
    classification: str = CLASSIFICATION
    state: str = "SHADOW_CANDIDATE_UNAPPROVED"
    production_approved: bool = False
    public_forecasts_authorized: bool = False
    holdout_2025_26_read: bool = False


def _digest(value: object) -> str:
    return sha256(
        dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"),
              allow_nan=False).encode("utf-8")
    ).hexdigest()


def _sha(value: str) -> bool:
    return type(value) is str and len(value) == 64 and set(value) <= SHA_HEX


def _validated_source(snapshots: tuple[SourceSnapshot, ...]) -> str:
    if (type(snapshots) is not tuple or len(snapshots) != 7
            or tuple(x.season for x in snapshots) != DEVELOPMENT_SEASONS):
        raise DataError("M4: seven ordered development snapshot receipts required")
    if any(
        not isinstance(x, SourceSnapshot) or not _sha(x.source_sha256)
        or not _sha(x.normalized_sha256) or x.source_sha256 == x.normalized_sha256
        for x in snapshots
    ):
        raise DataError("M4: source receipt digest missing or malformed")
    return _digest([(x.season, x.source_sha256, x.normalized_sha256)
                    for x in snapshots])


def fit_private_shadow_candidate(
    fixtures: tuple[DevelopmentMatch, ...],
    snapshots: tuple[SourceSnapshot, ...],
) -> PrivateCandidate:
    """Fit frozen M3 shrinkage on 1673 eligible historical rows only.

    Input must already be classified by the separately reviewed M3 A3
    provider/public played-vs-award crosswalk. This function alone does not
    elevate provider-finished results to certified real played scores.
    """
    manifest_sha = _validated_source(snapshots)
    if type(fixtures) is not tuple or len(fixtures) != 1673:
        raise DataError("M4: expected exactly 1673 played-score candidates")
    if any(not isinstance(r, DevelopmentMatch) or r.result_kind != "played"
           for r in fixtures):
        raise DataError("M4: unverified or unplayed result role")
    # Existing M3 validation rejects duplicate identities, unknown seasons,
    # missing timezone, non-UTC dates and invalid goals, including 2025/26.
    build_development_features(fixtures)
    by_season = Counter(row.season for row in fixtures)
    if tuple(by_season.get(s, 0) for s in DEVELOPMENT_SEASONS) != EXPECTED_COUNTS:
        raise DataError("M4: per-season played-score exclusions changed")
    clubs = set()
    seen_daily: set[tuple[str, object, str]] = set()
    for row in fixtures:
        clubs.update((row.home_team_id, row.away_team_id))
        for team in (row.home_team_id, row.away_team_id):
            key = row.season, row.kickoff_at.date(), team
            if key in seen_daily:
                raise DataError("M4: team has two fixtures on one UTC day")
            seen_daily.add(key)
    if len(clubs) != EXPECTED_CLUBS:
        raise DataError("M4: seven-season club continuity topology differs")
    for season in DEVELOPMENT_SEASONS:
        season_rows = (r for r in fixtures if r.season == season)
        home = Counter()
        away = Counter()
        for row in season_rows:
            home[row.home_team_id] += 1
            away[row.away_team_id] += 1
        if len(set(home) | set(away)) != 16 or (
            any(value > 15 for value in (*home.values(), *away.values()))
        ):
            raise DataError("M4: incomplete season team identity topology")
    rows = tuple(sorted(
        fixtures, key=lambda r: (r.season, r.kickoff_at, r.source_match_id)
    ))
    row_signature = [[
        r.season, r.source_match_id, r.kickoff_at.isoformat(),
        r.home_team_id, r.away_team_id, r.home_goals, r.away_goals
    ] for r in rows]
    row_sha = _digest(row_signature)
    home_total = sum(r.home_goals for r in rows)
    away_total = sum(r.away_goals for r in rows)
    n = len(rows)
    mu_h = (home_total + LEAGUE_PRIOR_MATCHES * HOME_GOALS_PRIOR) / (
        n + LEAGUE_PRIOR_MATCHES
    )
    mu_a = (away_total + LEAGUE_PRIOR_MATCHES * AWAY_GOALS_PRIOR) / (
        n + LEAGUE_PRIOR_MATCHES
    )
    if not all(isfinite(x) and 0 < x <= 20 for x in (mu_h, mu_a)):
        raise DataError("M4: impossible scoring-rate aggregate")
    # [home N, away N, home scored, home conceded, away scored, away conceded]
    stats: dict[str, list[int]] = defaultdict(lambda: [0, 0, 0, 0, 0, 0])
    for r in rows:
        h, a = stats[r.home_team_id], stats[r.away_team_id]
        h[0] += 1
        h[2] += r.home_goals
        h[3] += r.away_goals
        a[1] += 1
        a[4] += r.away_goals
        a[5] += r.home_goals
    payload = {
        "schema": 1,
        "version": MODEL_VERSION,
        "classification": CLASSIFICATION,
        "state": "SHADOW_CANDIDATE_UNAPPROVED",
        "developmentSeasons": list(DEVELOPMENT_SEASONS),
        "sourceManifestSha256": manifest_sha,
        "eligibleRowsSha256": row_sha,
        "trainingMatches": n,
        "distinctClubs": len(stats),
        "leagueHome": mu_h,
        "leagueAway": mu_a,
        "teamPseudoMatches": TEAM_PSEUDO_MATCHES,
        "leaguePriorMatches": LEAGUE_PRIOR_MATCHES,
        "homeGoalsPrior": HOME_GOALS_PRIOR,
        "awayGoalsPrior": AWAY_GOALS_PRIOR,
        "minRate": MIN_RATE,
        "maxRate": MAX_RATE,
        "teams": [[name, *stats[name]] for name in sorted(stats)],
        "productionApproved": False,
        "publicForecastsAuthorized": False,
        "holdout2025_26Read": False,
    }
    artifact = dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
        allow_nan=False,
    ).encode("utf-8")
    if len(artifact) > 32768:
        raise DataError("M4: private model artifact exceeds bound")
    return PrivateCandidate(
        artifact_bytes=artifact,
        artifact_sha256=sha256(artifact).hexdigest(),
        source_manifest_sha256=manifest_sha,
        eligible_rows_sha256=row_sha,
        eligible_matches=n,
        distinct_clubs=len(stats),
    )


def private_candidate_distribution(
    candidate: PrivateCandidate, home_team_id: str, away_team_id: str,
) -> ScoreDistribution:
    """Private mathematical prediction only; unknown clubs ABSTAIN."""
    if (not isinstance(candidate, PrivateCandidate) or
            sha256(candidate.artifact_bytes).hexdigest() != candidate.artifact_sha256):
        raise DataError("M4: invalid candidate artifact digest")
    data = loads(candidate.artifact_bytes)
    if (data.get("version") != MODEL_VERSION or data.get("schema") != 1
            or data.get("trainingMatches") != 1673
            or data.get("distinctClubs") != EXPECTED_CLUBS
            or data.get("publicForecastsAuthorized") is not False
            or data.get("productionApproved") is not False
            or data.get("holdout2025_26Read") is not False):
        raise DataError("M4: candidate is not private and frozen")
    teams = {row[0]: row[1:] for row in data["teams"]}
    if (type(home_team_id) is not str or type(away_team_id) is not str
            or home_team_id == away_team_id or home_team_id not in teams
            or away_team_id not in teams):
        raise DataError("M4: unknown or ambiguous club identity: ABSTAIN")
    h, a = teams[home_team_id], teams[away_team_id]
    mu_h, mu_a = data["leagueHome"], data["leagueAway"]
    pseudo = TEAM_PSEUDO_MATCHES
    home_attack = (h[2] + pseudo * mu_h) / (h[0] + pseudo)
    away_defence = (a[5] + pseudo * mu_h) / (a[1] + pseudo)
    away_attack = (a[4] + pseudo * mu_a) / (a[1] + pseudo)
    home_defence = (h[3] + pseudo * mu_a) / (h[0] + pseudo)
    home_lambda = max(MIN_RATE, min(MAX_RATE, home_attack * away_defence / mu_h))
    away_lambda = max(MIN_RATE, min(MAX_RATE, away_attack * home_defence / mu_a))
    return poisson_score_distribution(home_lambda, away_lambda, cutoff=8)
