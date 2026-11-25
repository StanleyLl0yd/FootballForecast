"""Synthetic-only KDK scope claims; no actual RFS documents or requests."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import loads

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    RFS_KDK_ARCHIVE,
    RFS_ROUND15_KDK_AGENDA,
)
from football_forecast.evaluation.m4_kdk_scope_binding import (
    AUDIENCE_PREFIX,
    KdkDocumentClaim,
    prepare_kdk_scope_binding,
)
from football_forecast.evaluation.m4_result_admission import FrozenFixtureIdentity

NOW = datetime(2026, 11, 27, 12, tzinfo=UTC)
SCOPE = NOW - timedelta(seconds=30)
LATEST = NOW - timedelta(minutes=2)
BODY = b"synthetic archive " * 40
AGENDA = b"synthetic agenda " * 40
DECISION = b"synthetic decision " * 40
FIXTURE = FrozenFixtureIdentity(
    "rpl-2026-27-r15-20261121-1000", "synthetic:match",
    datetime(2026, 11, 21, 10, tzinfo=UTC), "orenburg", "baltika",
)
ARCHIVE = KdkDocumentClaim(
    "ARCHIVE", RFS_KDK_ARCHIVE, sha256(BODY).hexdigest(), NOW,
)
NOTICE = KdkDocumentClaim(
    "AGENDA", RFS_ROUND15_KDK_AGENDA, sha256(AGENDA).hexdigest(), NOW,
)
ORDER = KdkDocumentClaim(
    "DECISION", "https://www.rfs.ru/news/999999999",
    sha256(DECISION).hexdigest(), NOW,
    datetime(2026, 11, 26, 14, tzinfo=UTC), "NO_ADVERSE_CLAIM",
    FIXTURE.fixture_key,
)


def bind(docs=(ARCHIVE, NOTICE), bodies=(BODY, AGENDA), **changes):
    args = dict(
        fixture=FIXTURE, scope_from=FIXTURE.kickoff_at,
        scope_through=SCOPE, latest_evidence_at=LATEST, inspected_at=NOW,
        documents=docs, bodies=bodies,
    )
    return prepare_kdk_scope_binding(**(args | changes))


def test_canonical_manifest_binds_exact_bytes_and_stays_pending_after_hearing():
    first = bind()
    second = bind((NOTICE, ARCHIVE), (AGENDA, BODY))
    assert first == second
    assert first.manifest_sha256 == sha256(first.manifest_bytes).hexdigest()
    assert first.audience == AUDIENCE_PREFIX + first.manifest_sha256
    assert first.classification == "PRIVATE_KDK_PENDING_REVIEW_REQUIRED"
    assert loads(first.manifest_bytes)["scopeComplete"] is False
    assert not first.scope_complete
    assert not first.kdk_clearance_attested
    assert not first.github_digest_time_attested
    assert not first.publisher_authenticated
    assert not first.played_final_attested
    assert not first.scoring_authorized
    assert not first.settlement_authorized
    assert not first.model_approved
    assert not first.publication_authorized
    assert not first.holdout_2025_26_read


@pytest.mark.parametrize(("disposition", "expected"), [
    ("NO_ADVERSE_CLAIM", "PRIVATE_KDK_PENDING_REVIEW_REQUIRED"),
    ("PENDING", "PRIVATE_KDK_PENDING_REVIEW_REQUIRED"),
    ("AMBIGUOUS", "PRIVATE_KDK_AMBIGUOUS_CLAIM_BLOCKED"),
    ("ADVERSE", "PRIVATE_KDK_ADVERSE_CLAIM_BLOCKED"),
])
def test_claimed_decision_never_clears_known_pending_scope(disposition, expected):
    result = bind((ARCHIVE, NOTICE, replace(ORDER, disposition=disposition)),
                  (BODY, AGENDA, DECISION))
    assert result.classification == expected
    assert result.manifest_sha256 != bind().manifest_sha256
    assert not result.kdk_clearance_attested


def test_non_agenda_fixture_remains_unreviewed_not_cleared():
    fixture = FrozenFixtureIdentity(
        "rpl-2026-27-r15-20261121-1430", "synthetic:other",
        datetime(2026, 11, 21, 14, 30, tzinfo=UTC), "rubin", "zenit",
    )
    result = bind((ARCHIVE,), (BODY,), fixture=fixture)
    assert result.classification == "PRIVATE_KDK_SCOPE_UNREVIEWED"
    assert not result.scope_complete


@pytest.mark.parametrize("docs,bodies", [
    ((ARCHIVE,), (BODY,)),
    ((NOTICE,), (AGENDA,)),
    ((ARCHIVE, NOTICE), (AGENDA, BODY)),
    ((ARCHIVE, NOTICE, ARCHIVE), (BODY, AGENDA, BODY)),
    ((replace(ARCHIVE, locator="https://example.invalid/archive"), NOTICE), (BODY, AGENDA)),
    ((ARCHIVE, replace(NOTICE, kind="DECISION")), (BODY, AGENDA)),
    ((ARCHIVE, replace(NOTICE, observed_at=SCOPE - timedelta(seconds=1))), (BODY, AGENDA)),
    ((ARCHIVE, NOTICE, replace(ORDER, fixture_key="other")), (BODY, AGENDA, DECISION)),
    ((ARCHIVE, NOTICE, replace(ORDER, issued_at=NOW)), (BODY, AGENDA, DECISION)),
    ((ARCHIVE, NOTICE, replace(ORDER, issued_at=FIXTURE.kickoff_at)), (BODY, AGENDA, DECISION)),
    ((ARCHIVE, NOTICE, replace(ORDER, locator="https://www.rfs.ru/news/999?x=1")),
     (BODY, AGENDA, DECISION)),
])
def test_invalid_document_metadata_or_bytes_fail_closed(docs, bodies):
    with pytest.raises(DataError):
        bind(docs, bodies)


@pytest.mark.parametrize("changes", [
    {"scope_from": FIXTURE.kickoff_at + timedelta(seconds=1)},
    {"scope_through": LATEST - timedelta(seconds=1)},
    {"scope_through": NOW + timedelta(seconds=1)},
    {"latest_evidence_at": NOW},
    {"inspected_at": NOW + timedelta(minutes=6)},
    {"scope_from": datetime(2025, 7, 1, tzinfo=UTC)},
    {"fixture": replace(FIXTURE, home_club_key="baltika", away_club_key="orenburg")},
])
def test_invalid_scope_and_identity_fail_closed(changes):
    with pytest.raises(DataError):
        bind(**changes)
