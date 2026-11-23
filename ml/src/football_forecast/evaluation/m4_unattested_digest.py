"""M4-A6 GitHub digest clocks for source scores with UNKNOWN played status.

Both raw observations are untrusted. A MatchTV calendar score has NO played
vs awarded semantics. This function proves only GitHub's OIDC issuance time
for two distinct body digests, not a final result, publisher signature or
source publication time. NEVER convert its output into A6 settlement/scoring.
No network, database or 2025/26 access.
"""
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from hashlib import sha256

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_postmatch_sources import MATCHTV_MATCH_IDS
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.evaluation.m4_result_oidc import (
    CORROBORATION_AUDIENCE,
    MAX_CORROBORATION_BYTES,
    MAX_PRIMARY_BYTES,
    PRIMARY_AUDIENCE,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED
from football_forecast.research.m4_github_time_attestation import (
    POSTMATCH_WORKFLOW,
    verify_github_time_jwt,
)

MIN_POSTMATCH = timedelta(minutes=90)
MAX_STALENESS = timedelta(minutes=5)


@dataclass(frozen=True, slots=True)
class UnattestedScoreDigestClock:
    classification: str
    fixture_key: str
    primary_sha256: str
    corroboration_sha256: str
    primary_token_sha256: str
    corroboration_token_sha256: str
    primary_issued_at: datetime
    corroboration_issued_at: datetime
    primary_jwk_json: str
    corroboration_jwk_json: str
    github_digest_time_attested: bool = True
    publisher_authenticity_attested: bool = False
    independent_played_final_attested: bool = False
    settlement_authorized: bool = False
    scoring_authorized: bool = False
    model_approved: bool = False
    publication_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny():
    raise DataError("M4-A6: private unknown-played source byte clock refused")


def _utc(value):
    return (
        type(value) is datetime
        and value.tzinfo is not None
        and value.utcoffset() == timedelta(0)
    )


def _validate_untrusted_score_claim(fixture, claim, expected_issuer, verified_at):
    # "trusted" only means structurally consistent with A5, never truthful.
    if (
        type(claim) is not ProviderResultClaim
        or claim.issuer != expected_issuer
        or claim.fixture_key != fixture.fixture_key
        or claim.kickoff_at != fixture.kickoff_at
        or claim.home_club_key != fixture.home_club_key
        or claim.away_club_key != fixture.away_club_key
        or claim.competition != fixture.competition
        or claim.season != fixture.season
        or not _utc(claim.kickoff_at)
        or not _utc(claim.observed_at)
        or claim.observed_at < fixture.kickoff_at + MIN_POSTMATCH
        or claim.observed_at > verified_at
        or verified_at - claim.observed_at > MAX_STALENESS
        or type(claim.home_goals) is not int
        or type(claim.away_goals) is not int
        or not 0 <= claim.home_goals <= 20
        or not 0 <= claim.away_goals <= 20
        or type(claim.source_fixture_ref) is not str
        or re.fullmatch(r"[A-Za-z0-9_.:-]{2,160}", claim.source_fixture_ref) is None
        or type(claim.source_response_sha256) is not str
        or re.fullmatch(r"[a-f0-9]{64}", claim.source_response_sha256) is None
    ):
        _deny()
    if expected_issuer == "openfoot":
        if (claim.source_fixture_ref != fixture.source_match_id
                or (claim.status, claim.result_kind) not in (
                    ("finished", "played"),
                    ("score_displayed_unverified", "unknown"),
                )):
            _deny()
    else:
        # The current-season calendar NEVER certifies an actual played final.
        if (
            claim.source_fixture_ref !=
                "matchtv:" + MATCHTV_MATCH_IDS[fixture.fixture_key]
            or claim.status != "score_displayed_unverified"
            or claim.result_kind != "unknown"
        ):
            _deny()


def verify_unattested_postmatch_score_digests(
    fixture: FrozenFixtureIdentity,
    primary: ProviderResultClaim,
    corroboration: ProviderResultClaim,
    primary_body: bytes,
    corroboration_body: bytes,
    primary_token: str,
    corroboration_token: str,
    trusted_github_jwks: tuple[dict, ...],
    github_env: dict[str, str],
    verified_at: datetime,
) -> UnattestedScoreDigestClock:
    """Return a read-only private byte-clock, NOT a played result candidate."""
    if (
        type(fixture) is not FrozenFixtureIdentity
        or not _utc(verified_at)
        or not _utc(fixture.kickoff_at)
        or fixture.competition != "RPL"
        or fixture.season != "2026/27"
        or type(fixture.fixture_key) is not str
        or type(fixture.source_match_id) is not str
        or re.fullmatch(r"[A-Za-z0-9_.:-]{2,160}", fixture.source_match_id) is None
        or fixture.fixture_key not in MATCHTV_MATCH_IDS
        or (
            fixture.kickoff_at.strftime("%Y-%m-%dT%H:%M:%SZ") not in DIRECTED
        )
        or fixture.fixture_key !=
            "rpl-2026-27-r15-" + fixture.kickoff_at.strftime("%Y%m%d-%H%M")
        or (fixture.home_club_key, fixture.away_club_key) != DIRECTED[
            fixture.kickoff_at.strftime("%Y-%m-%dT%H:%M:%SZ")
        ]
        or type(primary_body) is not bytes
        or not 2 <= len(primary_body) <= MAX_PRIMARY_BYTES
        or type(corroboration_body) is not bytes
        or not 512 <= len(corroboration_body) <= MAX_CORROBORATION_BYTES
        or type(primary_token) is not str
        or type(corroboration_token) is not str
        or primary_token == corroboration_token
        or type(trusted_github_jwks) is not tuple
        or type(github_env) is not dict
    ):
        _deny()
    _validate_untrusted_score_claim(fixture, primary, "openfoot", verified_at)
    _validate_untrusted_score_claim(fixture, corroboration, "matchtv", verified_at)
    if (
        primary.observed_at > corroboration.observed_at
        or primary.source_response_sha256 == corroboration.source_response_sha256
        or sha256(primary_body).hexdigest() != primary.source_response_sha256
        or sha256(corroboration_body).hexdigest() != corroboration.source_response_sha256
        or (primary.home_goals, primary.away_goals) != (
            corroboration.home_goals, corroboration.away_goals
        )
    ):
        _deny()
    primary_utc, primary_jwk = verify_github_time_jwt(
        primary_token, PRIMARY_AUDIENCE + primary.source_response_sha256,
        trusted_github_jwks, github_env, primary.observed_at, verified_at,
        workflow_ref=POSTMATCH_WORKFLOW,
    )
    corroboration_utc, corroboration_jwk = verify_github_time_jwt(
        corroboration_token,
        CORROBORATION_AUDIENCE + corroboration.source_response_sha256,
        trusted_github_jwks, github_env, corroboration.observed_at,
        verified_at, workflow_ref=POSTMATCH_WORKFLOW,
    )
    issued_primary = datetime.fromisoformat(primary_utc.replace("Z", "+00:00"))
    issued_other = datetime.fromisoformat(corroboration_utc.replace("Z", "+00:00"))
    if (
        issued_primary < fixture.kickoff_at + MIN_POSTMATCH
        or issued_other < fixture.kickoff_at + MIN_POSTMATCH
        or issued_primary < primary.observed_at.replace(microsecond=0)
        or issued_other < corroboration.observed_at.replace(microsecond=0)
        or issued_primary > issued_other
    ):
        _deny()
    return UnattestedScoreDigestClock(
        classification="PRIVATE_UNATTESTED_SCORE_DIGEST_CLOCKS",
        fixture_key=fixture.fixture_key,
        primary_sha256=primary.source_response_sha256,
        corroboration_sha256=corroboration.source_response_sha256,
        primary_token_sha256=sha256(primary_token.encode("ascii")).hexdigest(),
        corroboration_token_sha256=sha256(
            corroboration_token.encode("ascii")
        ).hexdigest(),
        primary_issued_at=issued_primary,
        corroboration_issued_at=issued_other,
        primary_jwk_json=primary_jwk,
        corroboration_jwk_json=corroboration_jwk,
    )
