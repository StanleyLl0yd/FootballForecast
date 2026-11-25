"""Pure preparation of context-bound official witness receipts for M4-A6.

A digest-only receipt can be detached from the fixture, publisher, locator
and parsed claims. This contract commits those inputs together for a future
reviewed worker. No token issuance, source authentication, parser,
fetch, persistence or permission to run that worker is introduced.
"""
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import dumps

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    OfficialReportClaim,
    assess_practical_result_claims,
)
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_github_time_attestation import (
    CLUB_REPORT_WORKFLOW,
    verify_github_time_jwt,
)

AUDIENCE_PREFIX = "ff-m4-2026-27-official-witness-context-v1-sha256-"
MAX_BODY_BYTES = 8_000_000


@dataclass(frozen=True, slots=True)
class OfficialWitnessBinding:
    """Candidate manifest, NOT a receipt signed by GitHub or a publisher."""

    manifest_bytes: bytes = field(repr=False)
    manifest_sha256: str
    body_sha256: str
    audience: str
    github_digest_time_attested: bool = field(default=False, init=False)
    publisher_authenticated: bool = field(default=False, init=False)
    played_final_attested: bool = field(default=False, init=False)
    kdk_clearance_attested: bool = field(default=False, init=False)
    settlement_authorized: bool = field(default=False, init=False)
    scoring_authorized: bool = field(default=False, init=False)
    model_approved: bool = field(default=False, init=False)
    publication_authorized: bool = field(default=False, init=False)
    holdout_2025_26_read: bool = field(default=False, init=False)


def _stamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="microseconds")


def prepare_official_witness_bindings(
    fixture: FrozenFixtureIdentity,
    primary: ProviderResultClaim,
    corroboration: ProviderResultClaim,
    witnesses: tuple[OfficialReportClaim, ...],
    bodies: tuple[bytes, ...],
    inspected_at: datetime,
) -> tuple[OfficialWitnessBinding, ...]:
    """Bind the exact supplied bytes and untrusted semantics to each witness.

    Witnesses and bodies correspond positionally; the result is in that same
    order. The canonical manifest includes the complete validated witness set
    sorted by publisher so input ordering cannot change a witness's audience.
    Source-specific parsing, authenticity, rights, editorial independence,
    issued KDK review and a separately approved protected workflow remain
    mandatory. Never log or export the private manifest/body.
    """
    review = assess_practical_result_claims(
        fixture, primary, corroboration, witnesses, inspected_at,
    )
    if type(bodies) is not tuple or len(bodies) != len(witnesses):
        raise DataError("M4-A6 official witness body count mismatch")

    for report, body in zip(witnesses, bodies, strict=True):
        if (
            type(body) is not bytes
            or not 512 <= len(body) <= MAX_BODY_BYTES
            or sha256(body).hexdigest() != report.response_sha256
        ):
            raise DataError("M4-A6 official witness body refused")

    claims = [
        {
            "publisher": report.publisher,
            "locator": report.url,
            "bodySha256": report.response_sha256,
            "observedAt": _stamp(report.observed_at),
            "score": [report.home_goals, report.away_goals],
            "events": list(report.events),
            "goals": [
                [goal.credited_club, goal.home_goals, goal.away_goals]
                for goal in report.goals
            ],
        }
        for report in sorted(witnesses, key=lambda item: item.publisher)
    ]
    common = {
        "schema": "ff-m4-official-witness-context-v1",
        "fixture": {
            "fixtureKey": fixture.fixture_key,
            "sourceMatchId": fixture.source_match_id,
            "competition": fixture.competition,
            "season": fixture.season,
            "round": 15,
            "kickoffAt": _stamp(fixture.kickoff_at),
            "homeClub": fixture.home_club_key,
            "awayClub": fixture.away_club_key,
        },
        "providerClaims": [
            {
                "issuer": claim.issuer,
                "sourceFixtureRef": claim.source_fixture_ref,
                "bodySha256": claim.source_response_sha256,
                "observedAt": _stamp(claim.observed_at),
                "status": claim.status,
                "resultKind": claim.result_kind,
                "score": [claim.home_goals, claim.away_goals],
            }
            for claim in (primary, corroboration)
        ],
        "evidenceRoute": review.evidence_route,
        "witnessClaims": claims,
    }
    bindings = []
    for report in witnesses:
        manifest = dumps(
            {**common, "receiptPublisher": report.publisher},
            sort_keys=True, separators=(",", ":"), ensure_ascii=True,
        ).encode("ascii")
        digest = sha256(manifest).hexdigest()
        bindings.append(OfficialWitnessBinding(
            manifest_bytes=manifest,
            manifest_sha256=digest,
            body_sha256=report.response_sha256,
            audience=AUDIENCE_PREFIX + digest,
        ))
    return tuple(bindings)


MAX_WITNESS_AGE = timedelta(minutes=5)


@dataclass(frozen=True, slots=True)
class VerifiedOfficialWitnessReceipt:
    """A runner commitment to untrusted context; never publisher attestation."""

    manifest_sha256: str
    body_sha256: str
    token_sha256: str
    issued_at: datetime
    signing_jwk_json: str = field(repr=False)
    github_digest_time_attested: bool = field(default=True, init=False)
    publisher_authenticated: bool = field(default=False, init=False)
    played_final_attested: bool = field(default=False, init=False)
    kdk_clearance_attested: bool = field(default=False, init=False)
    settlement_authorized: bool = field(default=False, init=False)
    scoring_authorized: bool = field(default=False, init=False)
    model_approved: bool = field(default=False, init=False)
    publication_authorized: bool = field(default=False, init=False)
    holdout_2025_26_read: bool = field(default=False, init=False)


def verify_official_witness_receipts(
    fixture: FrozenFixtureIdentity,
    primary: ProviderResultClaim,
    corroboration: ProviderResultClaim,
    witnesses: tuple[OfficialReportClaim, ...],
    bodies: tuple[bytes, ...],
    tokens: tuple[str, ...],
    trusted_github_jwks: tuple[dict, ...],
    github_env: dict[str, str],
    verified_at: datetime,
) -> tuple[VerifiedOfficialWitnessReceipt, ...]:
    """Recompute context and verify all positional receipts or refuse the batch.

    This is a prospective verification contract for the existing owner club
    workflow identity, not a new workflow or permission to issue tokens.
    The currently deployed club probe issues raw-digest-only audiences;
    those tokens are deliberately incompatible with this verifier.
    Official bodies must all be freshly observed in the reviewed future run.
    Earlier provider claims may be retained; their signatures, provenance
    and parsing are NOT verified by this function. A later protected caller
    must independently establish those facts and trusted GitHub JWKS.
    No raw token, manifest or body is returned. No I/O or durable replay
    ledger; cross-run token reuse fails the pinned identity check.
    """
    if (
        type(verified_at) is not datetime
        or verified_at.tzinfo != UTC
        or type(tokens) is not tuple
        or type(trusted_github_jwks) is not tuple
        or type(github_env) is not dict
    ):
        raise DataError("M4-A6 official receipt inputs refused")
    bindings = prepare_official_witness_bindings(
        fixture, primary, corroboration, witnesses, bodies, verified_at,
    )
    if (
        len(tokens) != len(bindings)
        or any(type(token) is not str or not token.isascii() for token in tokens)
        or len(set(tokens)) != len(tokens)
        or any(
            verified_at - report.observed_at > MAX_WITNESS_AGE
            for report in witnesses
        )
    ):
        raise DataError("M4-A6 official receipt batch or clock refused")
    # Each audience commits the complete witness set and both provider
    # claims. A receipt must not predate ANY claimed observation, even
    # when its own body arrived earlier.
    latest = max(
        primary.observed_at, corroboration.observed_at,
        *(report.observed_at for report in witnesses),
    ).astimezone(UTC)
    receipts = []
    for binding, token in zip(bindings, tokens, strict=True):
        issued, jwk = verify_github_time_jwt(
            token, binding.audience, trusted_github_jwks, github_env,
            latest, verified_at, workflow_ref=CLUB_REPORT_WORKFLOW,
        )
        issued_at = datetime.fromisoformat(issued.replace("Z", "+00:00"))
        if not latest.replace(microsecond=0) <= issued_at <= verified_at:
            raise DataError("M4-A6 official receipt issuance clock refused")
        receipts.append(VerifiedOfficialWitnessReceipt(
            manifest_sha256=binding.manifest_sha256,
            body_sha256=binding.body_sha256,
            token_sha256=sha256(token.encode("ascii")).hexdigest(),
            issued_at=issued_at,
            signing_jwk_json=jwk,
        ))
    return tuple(receipts)
