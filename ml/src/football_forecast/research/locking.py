"""Private M2 pre-holdout research lock. Never loads or scores holdout labels.

All input records stay in memory; returned attestation contains digests and aggregate
counts only. The caller must generate corroboration in a trusted, pinned-source job.
"""
import json
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, replace
from hashlib import sha256
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.training_input import ReadCursor, read_training_input
from football_forecast.models.team_strength import fit_independent_poisson

PROTOCOL = "m2-independent-poisson-v1"
REFERENCE_BLOB = "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc"


def _digest(value: object) -> str:
    return sha256(json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")).hexdigest()


def _check_corroboration(report: object, source_sha256: str) -> None:
    """Enforce exact 240/240 score/date source agreement on the pinned CSV bytes."""
    if not isinstance(report, dict):
        raise DataError("M2 lock: missing source corroboration")
    expected = {
        "season": "2024/2025",
        "kind": "M0_SOURCE_REPORTED_MATCH_BY_MATCH_CROSSCHECK",
        "footbolnoCsvSHA256": source_sha256,
        "openFootballGitBlob": REFERENCE_BLOB,
        "compared": 240,
        "referenceCount": 240,
        "matchedDirectedFixtures": 240,
        "missingFromPublisher": 0,
        "missingFromOpenFootball": 0,
        "dateSourceErrors": 0,
        "structuralSourceErrors": 0,
        "referenceAwardedGames": 0,
        "mismatchedFixtures": 0,
        "observedPublisherAndOpenFootballAgreement": True,
    }
    if any(type(report.get(key)) is not type(value) or report.get(key) != value
           for key, value in expected.items()):
        raise DataError("M2 lock: unverified pinned source comparison")
    differences = report.get("differingFields")
    if not isinstance(differences, dict) or set(differences) != {
        "date", "homeGoals", "awayGoals", "resultType"
    } or any(type(value) is not int or value != 0 for value in differences.values()):
        raise DataError("M2 lock: unresolved match-level disagreement")


@dataclass(frozen=True, slots=True)
class PreHoldoutLock:
    """Public-safe aggregate lock, not evidence of an executed historical benchmark."""

    protocol: str
    code_sha: str
    source_sha256: str
    snapshot_identity_sha256: str
    train_rows_sha256: str
    club_mapping_sha256: str
    fitted_model_sha256: str
    train_outcome_counts: tuple[int, int, int]
    training_matches: int
    training_clubs: int
    research_classification: str = "NON_STRICT_RETROSPECTIVE"
    holdout_read: bool = False
    historical_prematch_verified: bool = False

    def as_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": 1,
            "kind": "M2_PRE_HOLDOUT_LOCK",
            "protocol": self.protocol,
            "codeSha": self.code_sha,
            "sourceSha256": self.source_sha256,
            "snapshotIdentitySha256": self.snapshot_identity_sha256,
            "trainRowsSha256": self.train_rows_sha256,
            "clubMappingSha256": self.club_mapping_sha256,
            "fittedModelSha256": self.fitted_model_sha256,
            "trainOutcomeCountsHDA": list(self.train_outcome_counts),
            "trainingMatches": self.training_matches,
            "trainingClubs": self.training_clubs,
            "researchClassification": self.research_classification,
            "holdoutRead": self.holdout_read,
            "historicalPrematchVerified": self.historical_prematch_verified,
            "modelAccuracyEvaluated": False,
        }


def prepare_pre_holdout_lock(
    cursor: ReadCursor,
    *,
    snapshot_id: str,
    source_sha256: str,
    code_sha: str,
    club_mapping: Mapping[str, str],
    corroboration: object,
) -> PreHoldoutLock:
    """Fit one fixed research candidate using only the privileged training reader.

    No connection, holdout read, artifact write or publication takes place here.
    Hash/commit and independently fetched comparator must be trusted by the caller;
    mere user-supplied JSON is not an independent external attestation.
    """
    if not isinstance(code_sha, str) or not fullmatch(r"[a-f0-9]{40}", code_sha):
        raise DataError("M2 lock: invalid pinned Git commit SHA")
    _check_corroboration(corroboration, source_sha256)
    data = read_training_input(cursor, snapshot_id=snapshot_id, source_sha256=source_sha256)
    teams = {club for fixture in data.fixtures
             for club in (fixture.home_team_id, fixture.away_team_id)}
    if (not isinstance(club_mapping, Mapping) or set(club_mapping) != teams
            or len(teams) != 16 or len(set(club_mapping.values())) != 16
            or any(not isinstance(value, str)
                   or not fullmatch(r"[A-Z0-9_-]{2,24}", value)
                   for value in club_mapping.values())):
        raise DataError("M2 lock: non-bijective predeclared training-only club mapping")

    mapped = tuple(replace(
        fixture,
        home_team_id=club_mapping[fixture.home_team_id],
        away_team_id=club_mapping[fixture.away_team_id],
    ) for fixture in data.fixtures)
    model = fit_independent_poisson(mapped)
    if model.training_matches != 240 or len(model.teams) != 16:
        raise DataError("M2 lock: incomplete fitted train cohort")

    outcomes = Counter(
        0 if f.home_goals > f.away_goals else 1 if f.home_goals == f.away_goals else 2
        for f in data.fixtures
    )
    train_rows = [
        [f.source_match_id, f.kickoff_at.isoformat(), f.home_team_id,
         f.away_team_id, f.home_goals, f.away_goals]
        for f in data.fixtures
    ]
    model_bytes = {
        "protocol": PROTOCOL, "teams": model.teams,
        "attack": [x.hex() for x in model.attack],
        "defence": [x.hex() for x in model.defence],
        "appearances": model.appearances,
        "intercept": model.intercept.hex(),
        "homeAdvantage": model.home_advantage.hex(),
        "trainingMatches": model.training_matches,
    }
    return PreHoldoutLock(
        protocol=PROTOCOL,
        code_sha=code_sha,
        source_sha256=source_sha256,
        snapshot_identity_sha256=_digest([data.snapshot_id, data.source_sha256,
                                         data.retrieved_at.isoformat()]),
        train_rows_sha256=_digest(train_rows),
        club_mapping_sha256=_digest(sorted(club_mapping.items())),
        fitted_model_sha256=_digest(model_bytes),
        train_outcome_counts=(outcomes[0], outcomes[1], outcomes[2]),
        training_matches=len(data.fixtures),
        training_clubs=len(model.teams),
    )
