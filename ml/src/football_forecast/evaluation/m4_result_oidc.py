"""M4-A6 detached GitHub OIDC digest clocks for PRIVATE post-match candidates.

A GitHub RS256 token can prove that the protected runner committed to these
exact bytes at GitHub's issuance time. It DOES NOT certify that a publisher
authored those bytes, that a parsed score matches them, that the match was
actually played rather than awarded, or that a result is final. A separate
reviewed source-specific parser/identity/played-status worker is mandatory
before any real result settlement. No database, public API or network I/O here.
Never use provider-supplied keys as trusted JWKS; the live runner must retrieve
the GitHub keys via the fixed issuer discovery in m4_github_time_attestation.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
    ProvisionalPlayedCandidate,
    compare_provisional_played_claims,
)
from football_forecast.research.m4_github_time_attestation import (
    POSTMATCH_WORKFLOW,
    verify_github_time_jwt,
)

PRIMARY_AUDIENCE = "ff-m4-2026-27-openfoot-sha256-"
CORROBORATION_AUDIENCE = "ff-m4-2026-27-matchtv-sha256-"
MIN_RESULT_DELAY = timedelta(minutes=90)
MAX_OBSERVATION_AGE = timedelta(minutes=5)
MAX_PRIMARY_BYTES = 150_000
MAX_CORROBORATION_BYTES = 8_000_000


@dataclass(frozen=True, slots=True)
class PostmatchDigestClockEvidence:
    """Private GitHub digest-time receipts; NEVER a trusted scored outcome."""

    candidate: ProvisionalPlayedCandidate
    primary_token_sha256: str
    corroboration_token_sha256: str
    primary_issued_at: datetime
    corroboration_issued_at: datetime
    primary_jwk_json: str
    corroboration_jwk_json: str
    github_digest_time_attested: bool = True
    publisher_authenticity_attested: bool = False
    played_final_attested: bool = False
    settlement_authorized: bool = False
    scoring_authorized: bool = False
    publication_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny() -> None:
    raise DataError("M4-A6: private post-match digest proof refused")


def verify_postmatch_digest_clock(
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
) -> PostmatchDigestClockEvidence:
    """Pure verifier for already fetched candidate bodies and GitHub RS256 JWTs.

    The caller is responsible for obtaining trusted_github_jwks ONLY from the
    fixed GitHub HTTPS OIDC issuer, and for parsing and authenticating each
    third-party body separately. Caller-provided observation times are not a
    publisher first-serving proof. Only a GitHub-issued digest clock is proved.
    """
    if (
        type(primary_body) is not bytes
        or not 2 <= len(primary_body) <= MAX_PRIMARY_BYTES
        or type(corroboration_body) is not bytes
        or not 512 <= len(corroboration_body) <= MAX_CORROBORATION_BYTES
        or type(primary_token) is not str
        or type(corroboration_token) is not str
        or primary_token == corroboration_token
        or type(github_env) is not dict
        or type(trusted_github_jwks) is not tuple
        or not isinstance(verified_at, datetime)
        or verified_at.tzinfo != UTC
    ):
        _deny()

    candidate = compare_provisional_played_claims(
        fixture, primary, corroboration, verified_at,
    )
    if (
        primary.observed_at > corroboration.observed_at
        or verified_at - primary.observed_at > MAX_OBSERVATION_AGE
        or verified_at - corroboration.observed_at > MAX_OBSERVATION_AGE
        or sha256(primary_body).hexdigest() != primary.source_response_sha256
        or sha256(corroboration_body).hexdigest() != corroboration.source_response_sha256
    ):
        _deny()

    # The audience cryptographically binds the *actual body bytes* to its
    # declared publisher slot; swapping bodies or JWTs fails verification.
    primary_utc, primary_jwk = verify_github_time_jwt(
        primary_token,
        PRIMARY_AUDIENCE + candidate.primary_sha256,
        trusted_github_jwks,
        github_env,
        primary.observed_at,
        verified_at,
        workflow_ref=POSTMATCH_WORKFLOW,
    )
    corroboration_utc, corroboration_jwk = verify_github_time_jwt(
        corroboration_token,
        CORROBORATION_AUDIENCE + candidate.corroboration_sha256,
        trusted_github_jwks,
        github_env,
        corroboration.observed_at,
        verified_at,
        workflow_ref=POSTMATCH_WORKFLOW,
    )
    primary_issued = datetime.fromisoformat(primary_utc.replace("Z", "+00:00"))
    corroboration_issued = datetime.fromisoformat(
        corroboration_utc.replace("Z", "+00:00")
    )
    if (
        primary_issued < fixture.kickoff_at + MIN_RESULT_DELAY
        or primary_issued < primary.observed_at.replace(microsecond=0)
        or corroboration_issued < corroboration.observed_at.replace(microsecond=0)
        or corroboration_issued < fixture.kickoff_at + MIN_RESULT_DELAY
        or primary_issued > corroboration_issued
    ):
        _deny()

    return PostmatchDigestClockEvidence(
        candidate=candidate,
        primary_token_sha256=sha256(primary_token.encode("ascii")).hexdigest(),
        corroboration_token_sha256=sha256(
            corroboration_token.encode("ascii")
        ).hexdigest(),
        primary_issued_at=primary_issued,
        corroboration_issued_at=corroboration_issued,
        primary_jwk_json=primary_jwk,
        corroboration_jwk_json=corroboration_jwk,
    )
