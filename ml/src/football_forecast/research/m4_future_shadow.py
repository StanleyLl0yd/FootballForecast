"""Pure M4 private prospective admission and deterministic model decisions.

No HTTP, DB access, 2025/26 holdout, publication or environment credentials.
These functions accept ONLY an already-corrobated future-source batch and
the exact immutable, unapproved development model artifact.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from json import dumps, loads

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_identity import (
    DIRECTED,
    _club,
    verify_directed_future_identities,
)
from football_forecast.research.m4_future_rpl_source import _json, _utc
from football_forecast.research.m4_private_candidate import (
    MODEL_VERSION,
    PrivateCandidate,
    private_candidate_distribution,
)

FROZEN_MODEL_SHA256 = "b3eeb4cf950c38507572c6c6b4e3db7f133cf7cc2ee0593b2d940c66394b0a0c"
TRAINING_SCOPE = "2018/19-2024/25-development-only"
PROOF_MODEL_STATE = "SHADOW_CANDIDATE_UNAPPROVED"
EXPECTED_FIXTURES = 8
PROVIDER_ID_CHARS = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.:-"
)


@dataclass(frozen=True, slots=True)
class FutureFixture:
    fixture_key: str
    source_match_id: str
    kickoff: datetime
    home_slug: str
    away_slug: str
    home_provider_id: str
    away_provider_id: str

    @property
    def mapping_sha256(self) -> str:
        fields = (
            self.fixture_key, self.source_match_id,
            self.home_slug, self.home_provider_id,
            self.away_slug, self.away_provider_id,
        )
        return sha256(("\n".join(fields) + "\n").encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class ShadowDecision:
    fixture_key: str
    kind: str
    reason: str | None
    home_win: float | None = None
    draw: float | None = None
    away_win: float | None = None
    expected_home: float | None = None
    expected_away: float | None = None
    prediction_sha256: str | None = None


def _deny():
    raise DataError("M4: sealed prospective evidence or model identity invalid")


def _id(value: object):
    if (type(value) is not str or not 2 <= len(value) <= 160 or
            any(char not in PROVIDER_ID_CHARS for char in value)):
        _deny()
    return value


def future_fixtures_from_validated_source(
    day_bytes: dict[str, bytes],
) -> tuple[FutureFixture, ...]:
    """Requires the independently pinned named fixture ID mapping."""
    verify_directed_future_identities(day_bytes)
    fixtures = []
    seen_match: set[str] = set()
    for day in sorted(day_bytes):
        doc = _json(day_bytes[day])
        for row in doc["data"]:
            kickoff = _utc(row["kickoffAt"])
            slot = kickoff.strftime("%Y-%m-%dT%H:%M:%SZ")
            home, away = DIRECTED[slot]
            if (row["status"] != "scheduled"
                    or _club(row["homeTeam"]["name"]) != home
                    or _club(row["awayTeam"]["name"]) != away):
                _deny()
            match = _id(row["id"])
            home_id = _id(row["homeTeam"]["id"])
            away_id = _id(row["awayTeam"]["id"])
            if match in seen_match or home_id == away_id:
                _deny()
            seen_match.add(match)
            fixtures.append(FutureFixture(
                fixture_key="rpl-2026-27-r15-" + kickoff.strftime("%Y%m%d-%H%M"),
                source_match_id=match,
                kickoff=kickoff,
                home_slug=home,
                away_slug=away,
                home_provider_id=home_id,
                away_provider_id=away_id,
            ))
    fixtures.sort(key=lambda f: f.kickoff)
    if (len(fixtures) != EXPECTED_FIXTURES or
            len({f.fixture_key for f in fixtures}) != EXPECTED_FIXTURES or
            any(f.kickoff.tzinfo != UTC for f in fixtures)):
        _deny()
    return tuple(fixtures)


def sealed_candidate_from_row(row: tuple) -> tuple[str, PrivateCandidate]:
    """Validate one exact escrow model row. Never export the artifact."""
    if type(row) is not tuple or len(row) != 14:
        _deny()
    (model_id, version, scope, count, clubs, manifest, eligible,
     model_sha, raw, model_state, production_approved, public_allowed,
     holdout_read, training_run_id) = row
    raw = bytes(raw)
    if (str(model_id) == "" or version != MODEL_VERSION
            or scope != TRAINING_SCOPE or count != 1673 or clubs != 26
            or model_sha != FROZEN_MODEL_SHA256
            or sha256(raw).hexdigest() != model_sha
            or model_state != PROOF_MODEL_STATE
            or (production_approved, public_allowed, holdout_read)
            != (False, False, False)
            or type(training_run_id) is not int or training_run_id <= 0
            or any(type(h) is not str or len(h) != 64 or
                   any(c not in "0123456789abcdef" for c in h)
                   for h in (manifest, eligible))):
        _deny()
    data = loads(raw)
    if (type(data) is not dict or data.get("schema") != 1
            or data.get("version") != MODEL_VERSION
            or data.get("trainingMatches") != 1673
            or data.get("distinctClubs") != 26
            or data.get("sourceManifestSha256") != manifest
            or data.get("eligibleRowsSha256") != eligible
            or data.get("state") != PROOF_MODEL_STATE
            or data.get("productionApproved") is not False
            or data.get("publicForecastsAuthorized") is not False
            or data.get("holdout2025_26Read") is not False
            or not isinstance(data.get("teams"), list)
            or len(data["teams"]) != 26):
        _deny()
    return str(model_id), PrivateCandidate(
        artifact_bytes=raw, artifact_sha256=model_sha,
        source_manifest_sha256=manifest, eligible_rows_sha256=eligible,
        eligible_matches=count, distinct_clubs=clubs,
    )


def private_shadow_decision(
    candidate: PrivateCandidate, fixture: FutureFixture,
) -> ShadowDecision:
    """Direct stable OpenFoot team IDs only; unknown identities ABSTAIN."""
    if not isinstance(fixture, FutureFixture):
        _deny()
    if candidate.artifact_sha256 != FROZEN_MODEL_SHA256:
        _deny()
    data = loads(candidate.artifact_bytes)
    ids = {row[0] for row in data["teams"]}
    if (fixture.home_provider_id not in ids or
            fixture.away_provider_id not in ids):
        return ShadowDecision(
            fixture_key=fixture.fixture_key,
            kind="ABSTAIN",
            reason="UNKNOWN_MODEL_CLUB_ID",
        )
    result = private_candidate_distribution(
        candidate, fixture.home_provider_id, fixture.away_provider_id
    )
    result.validate()
    # Bind the entire score grid and residual tail to the immutable 1X2 row.
    payload = {
        "model": candidate.artifact_sha256,
        "fixture": fixture.fixture_key,
        "mapping": fixture.mapping_sha256,
        "probabilities": [result.home_win, result.draw, result.away_win],
        "goals": [result.expected_home, result.expected_away],
        "scores": [[i, j, result.scores[i, j]]
                   for i, j in sorted(result.scores)],
        "tail": result.tail_mass,
    }
    fingerprint = sha256(
        dumps(payload, sort_keys=True, separators=(",", ":"),
              allow_nan=False).encode("utf-8")
    ).hexdigest()
    return ShadowDecision(
        fixture_key=fixture.fixture_key,
        kind="FORECAST",
        reason=None,
        home_win=result.home_win,
        draw=result.draw,
        away_win=result.away_win,
        expected_home=result.expected_home,
        expected_away=result.expected_away,
        prediction_sha256=fingerprint,
    )


def entry_idempotency_sha256(
    fixture: FutureFixture, model_sha: str, source_token_sha: str,
    kickoff_token_sha: str,
) -> str:
    if (not isinstance(fixture, FutureFixture)
            or model_sha != FROZEN_MODEL_SHA256
            or any(type(item) is not str or len(item) != 64
                   for item in (source_token_sha, kickoff_token_sha))
            or source_token_sha == kickoff_token_sha):
        _deny()
    return sha256(
        dumps(["M4-A5", fixture.fixture_key, model_sha,
               fixture.mapping_sha256, source_token_sha,
               kickoff_token_sha, 1],
              separators=(",", ":")).encode("utf-8")
    ).hexdigest()
