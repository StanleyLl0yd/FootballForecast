"""M4-A6 PURE result candidate gate. Not a result-source or time attestation.

This module makes no network/database calls. Caller-supplied provider claims,
source IDs and timestamps are NOT trusted evidence. A future protected worker
must independently authenticate actual source observations, reconcile them
against immutable A5 ledger captures, verify played-vs-technical status, and
persist append-only proof before any settlement or performance acceptance.
No historical backfill, 2025/26, forecasts, model approval or publication.
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from football_forecast.data.contracts import DataError

# Preregistered comparison pair before the first prospective fixture.
PRIMARY_ISSUER = "openfoot"
CORROBORATING_ISSUER = "matchtv"
MIN_POST_KICKOFF = timedelta(minutes=90)
SHA_PATTERN = re.compile(r"[a-f0-9]{64}\Z")
SOURCE_REF_PATTERN = re.compile(r"[A-Za-z0-9_./:-]{1,160}\Z")
CLUB_PATTERN = re.compile(r"[a-z][a-z0-9_]{1,63}\Z")
M4_START = datetime(2026, 11, 11, 11, 4, 56, tzinfo=UTC)
FIRST_ELIGIBLE = datetime(2026, 7, 1, tzinfo=UTC)
LAST_ELIGIBLE = datetime(2027, 7, 1, tzinfo=UTC)


@dataclass(frozen=True, slots=True)
class FrozenFixtureIdentity:
    """Must ultimately originate from an immutable, verified A5 capture."""

    fixture_key: str
    kickoff_at: datetime
    home_club_key: str
    away_club_key: str
    competition: str = "RPL"
    season: str = "2026/27"


@dataclass(frozen=True, slots=True)
class ProviderResultClaim:
    """Untrusted parsed metadata, never a signed or independently verified fact."""

    issuer: str
    source_fixture_ref: str
    fixture_key: str
    kickoff_at: datetime
    home_club_key: str
    away_club_key: str
    observed_at: datetime
    source_response_sha256: str
    status: str
    result_kind: str
    home_goals: int
    away_goals: int
    competition: str = "RPL"
    season: str = "2026/27"


@dataclass(frozen=True, slots=True)
class ProvisionalPlayedCandidate:
    """Private consistency candidate. All authorization claims remain false."""

    classification: str
    fixture_key: str
    kickoff_at: datetime
    home_goals: int
    away_goals: int
    compared_at: datetime
    primary_sha256: str
    corroboration_sha256: str
    source_time_attested: bool = False
    independent_played_final_attested: bool = False
    settlement_authorized: bool = False
    publication_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny(reason: str) -> None:
    raise DataError("M4 private outcome preflight: " + reason)


def _utc(value: object) -> bool:
    return (
        isinstance(value, datetime)
        and value.tzinfo is not None
        and value.utcoffset() is not None
        and value.utcoffset().total_seconds() == 0
    )


def _sha(value: object) -> bool:
    return type(value) is str and SHA_PATTERN.fullmatch(value) is not None


def _clubs(home: object, away: object) -> bool:
    return (
        type(home) is str
        and type(away) is str
        and home != away
        and CLUB_PATTERN.fullmatch(home) is not None
        and CLUB_PATTERN.fullmatch(away) is not None
    )


def compare_provisional_played_claims(
    fixture: FrozenFixtureIdentity,
    primary: ProviderResultClaim,
    corroboration: ProviderResultClaim,
    inspected_at: datetime,
) -> ProvisionalPlayedCandidate:
    """Reject unsupported or discordant claims; NEVER approve real settlement.

    These are untrusted metadata from two *declared* providers. The protected
    A6 executor must prove source authenticity, independence, server times,
    match identity and final played status separately before scoring.
    """
    if (
        type(fixture) is not FrozenFixtureIdentity
        or type(primary) is not ProviderResultClaim
        or type(corroboration) is not ProviderResultClaim
        or not _utc(inspected_at)
        or not _utc(fixture.kickoff_at)
        or not FIRST_ELIGIBLE <= fixture.kickoff_at < LAST_ELIGIBLE
        or fixture.kickoff_at <= M4_START + timedelta(minutes=15)
        or type(fixture.fixture_key) is not str
        or not re.fullmatch(r"rpl-[a-zA-Z0-9_-]{1,96}", fixture.fixture_key)
        or not _clubs(fixture.home_club_key, fixture.away_club_key)
        or fixture.competition != "RPL"
        or fixture.season != "2026/27"
    ):
        _deny("invalid frozen fixture or inspected clock")
    if (
        primary.issuer != PRIMARY_ISSUER
        or corroboration.issuer != CORROBORATING_ISSUER
        or not _sha(primary.source_response_sha256)
        or not _sha(corroboration.source_response_sha256)
        or primary.source_response_sha256 == corroboration.source_response_sha256
    ):
        _deny("source pair or response digest is not independently structured")
    for claim in (primary, corroboration):
        if (
            claim.fixture_key != fixture.fixture_key
            or claim.kickoff_at != fixture.kickoff_at
            or claim.home_club_key != fixture.home_club_key
            or claim.away_club_key != fixture.away_club_key
            or claim.competition != fixture.competition
            or claim.season != fixture.season
            or type(claim.source_fixture_ref) is not str
            or SOURCE_REF_PATTERN.fullmatch(claim.source_fixture_ref) is None
            or not _utc(claim.kickoff_at)
            or not _utc(claim.observed_at)
            or not (
                fixture.kickoff_at + MIN_POST_KICKOFF
                <= claim.observed_at <= inspected_at
            )
            or claim.status != "finished"
            or claim.result_kind != "played"
            or type(claim.home_goals) is not int
            or type(claim.away_goals) is not int
            or not 0 <= claim.home_goals <= 20
            or not 0 <= claim.away_goals <= 20
        ):
            _deny("unverified, premature, technical or identity-mismatched result")
    if (
        primary.home_goals != corroboration.home_goals
        or primary.away_goals != corroboration.away_goals
    ):
        _deny("independent result claims disagree")
    return ProvisionalPlayedCandidate(
        classification="PRIVATE_RESULT_CANDIDATE_UNATTESTED",
        fixture_key=fixture.fixture_key,
        kickoff_at=fixture.kickoff_at,
        home_goals=primary.home_goals,
        away_goals=primary.away_goals,
        compared_at=inspected_at,
        primary_sha256=primary.source_response_sha256,
        corroboration_sha256=corroboration.source_response_sha256,
    )
