"""Pure, candidate-only KDK review manifest; no I/O or clearance.

Only the already pinned archive entry point and agenda are recognized here.
Decision locators are retained claims, never instructions or fetch authority.
One archive snapshot cannot establish exhaustive dated coverage.
"""
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import dumps

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    PENDING_KDK_FIXTURES,
    RFS_KDK_ARCHIVE,
    RFS_ROUND15_KDK_AGENDA,
    _guard_fixture,
)
from football_forecast.evaluation.m4_result_admission import FrozenFixtureIdentity

AUDIENCE_PREFIX = "ff-m4-2026-27-kdk-scope-v1-sha256-"
MAX_BODY_BYTES = 8_000_000
MAX_DOCUMENTS = 16
MAX_MANIFEST_BYTES = 32768
SEASON_START = datetime(2026, 7, 1, tzinfo=UTC)
_DECISION_URL = re.compile(r"https://www[.]rfs[.]ru/news/[0-9]{1,12}\Z")
_SHA = re.compile(r"[a-f0-9]{64}\Z")
_HEARING_DATE = datetime(2026, 11, 26, tzinfo=UTC)
_DISPOSITIONS = frozenset({
    "NO_ADVERSE_CLAIM", "ADVERSE", "AMBIGUOUS", "PENDING",
})


@dataclass(frozen=True, slots=True)
class KdkDocumentClaim:
    """Untrusted source metadata; an issued date is a claim, not proof."""

    kind: str
    locator: str
    body_sha256: str
    observed_at: datetime
    issued_at: datetime | None = None
    disposition: str | None = None
    fixture_key: str | None = None


@dataclass(frozen=True, slots=True)
class KdkScopeBinding:
    """Candidate manifest, never exhaustive review or an attested receipt."""

    manifest_bytes: bytes = field(repr=False)
    manifest_sha256: str
    audience: str
    classification: str
    scope_complete: bool = field(default=False, init=False)
    github_digest_time_attested: bool = field(default=False, init=False)
    publisher_authenticated: bool = field(default=False, init=False)
    kdk_clearance_attested: bool = field(default=False, init=False)
    played_final_attested: bool = field(default=False, init=False)
    settlement_authorized: bool = field(default=False, init=False)
    scoring_authorized: bool = field(default=False, init=False)
    model_approved: bool = field(default=False, init=False)
    publication_authorized: bool = field(default=False, init=False)
    holdout_2025_26_read: bool = field(default=False, init=False)


def _deny():
    raise DataError("M4-A6 KDK scope manifest refused")


def _utc(value):
    return type(value) is datetime and value.tzinfo == UTC


def _stamp(value):
    return value.isoformat(timespec="microseconds")


def prepare_kdk_scope_binding(
    fixture: FrozenFixtureIdentity,
    scope_from: datetime,
    scope_through: datetime,
    latest_evidence_at: datetime,
    inspected_at: datetime,
    documents: tuple[KdkDocumentClaim, ...],
    bodies: tuple[bytes, ...],
) -> KdkScopeBinding:
    """Commit scoped metadata and exact body digests, preserving uncertainty.

    A fresh archive snapshot is mandatory; known pending fixtures also
    require the pinned agenda. Decision claims can never clear known cases
    here: case-level linkage, current coverage, provenance, independent
    parsing and rights remain mandatory. No JWT issuance or storage.
    """
    _guard_fixture(fixture, inspected_at)
    if (
        not all(_utc(t) for t in (
            fixture.kickoff_at, scope_from, scope_through,
            latest_evidence_at, inspected_at,
        ))
        or not SEASON_START <= scope_from <= fixture.kickoff_at
        or not fixture.kickoff_at + timedelta(minutes=90)
        <= latest_evidence_at <= scope_through <= inspected_at
        or inspected_at - scope_through > timedelta(minutes=5)
        or type(documents) is not tuple
        or type(bodies) is not tuple
        or not 1 <= len(documents) == len(bodies) <= MAX_DOCUMENTS
    ):
        _deny()

    locators = set()
    digests = set()
    archive_count = agenda_count = 0
    dispositions = set()
    claims = []
    for doc, body in zip(documents, bodies, strict=True):
        if (
            type(doc) is not KdkDocumentClaim
            or type(doc.kind) is not str
            or type(doc.locator) is not str
            or type(doc.body_sha256) is not str
            or not _SHA.fullmatch(doc.body_sha256)
            or type(body) is not bytes
            or not 512 <= len(body) <= MAX_BODY_BYTES
            or sha256(body).hexdigest() != doc.body_sha256
            or doc.locator in locators
            or doc.body_sha256 in digests
            or not _utc(doc.observed_at)
            or not scope_through <= doc.observed_at <= inspected_at
        ):
            _deny()
        if doc.kind == "ARCHIVE":
            if (
                doc.locator != RFS_KDK_ARCHIVE
                or doc.issued_at is not None
                or doc.disposition is not None
                or doc.fixture_key is not None
            ):
                _deny()
            archive_count += 1
        elif doc.kind == "AGENDA":
            if (
                doc.locator != RFS_ROUND15_KDK_AGENDA
                or doc.issued_at is not None
                or doc.disposition is not None
                or doc.fixture_key is not None
            ):
                _deny()
            agenda_count += 1
        elif doc.kind == "DECISION":
            if (
                not _DECISION_URL.fullmatch(doc.locator)
                or doc.locator == RFS_ROUND15_KDK_AGENDA
                or doc.fixture_key != fixture.fixture_key
                or not _utc(doc.issued_at)
                or not fixture.kickoff_at <= doc.issued_at <= scope_through
                or (fixture.fixture_key in PENDING_KDK_FIXTURES
                    and doc.issued_at < _HEARING_DATE)
                or type(doc.disposition) is not str
                or doc.disposition not in _DISPOSITIONS
            ):
                _deny()
            dispositions.add(doc.disposition)
        else:
            _deny()
        locators.add(doc.locator)
        digests.add(doc.body_sha256)
        claims.append({
            "kind": doc.kind,
            "locator": doc.locator,
            "bodySha256": doc.body_sha256,
            "observedAt": _stamp(doc.observed_at),
            "issuedAt": _stamp(doc.issued_at) if doc.issued_at is not None else None,
            "disposition": doc.disposition,
            "fixtureKey": doc.fixture_key,
        })
    known_pending = fixture.fixture_key in PENDING_KDK_FIXTURES
    if archive_count != 1 or (known_pending and agenda_count != 1):
        _deny()
    if "ADVERSE" in dispositions:
        state = "PRIVATE_KDK_ADVERSE_CLAIM_BLOCKED"
    elif "AMBIGUOUS" in dispositions:
        state = "PRIVATE_KDK_AMBIGUOUS_CLAIM_BLOCKED"
    elif known_pending or "PENDING" in dispositions:
        state = "PRIVATE_KDK_PENDING_REVIEW_REQUIRED"
    else:
        state = "PRIVATE_KDK_SCOPE_UNREVIEWED"

    manifest = dumps({
        "schema": "ff-m4-kdk-scope-v1",
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
        "scopeFrom": _stamp(scope_from),
        "scopeThrough": _stamp(scope_through),
        "latestEvidenceAt": _stamp(latest_evidence_at),
        "inspectedAt": _stamp(inspected_at),
        "knownPendingAgenda": known_pending,
        "documents": sorted(claims, key=lambda item: item["locator"]),
        "classification": state,
        "scopeComplete": False,
    }, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")
    if len(manifest) > MAX_MANIFEST_BYTES:
        _deny()
    digest = sha256(manifest).hexdigest()
    return KdkScopeBinding(manifest, digest, AUDIENCE_PREFIX + digest, state)
