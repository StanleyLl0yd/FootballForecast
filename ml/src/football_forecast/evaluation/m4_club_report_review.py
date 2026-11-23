"""M4-A6: candidate-only 2026/27 club reports; NEVER certify final results.

Official club post-match reports document on-field activity separately from
OpenFoot and MatchTV. They do not attest publisher-first-serving time, signed
played status, or absence of later KDK/RFS awards. This pure module never
fetches, persists, scores, approves or publishes any information. Its inputs
are caller-supplied *untrusted* claims, not original authenticated articles.
No 2025/26 historical H2H or sealed holdout is queried.
"""
import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED

# Current-season, current-round CLUB-operated pages found on 2026-11-23.
# Fixed URL strings only: provider-controlled URLs and redirect targets denied.
# An article's publication date and visible scores are not cryptographic proof.
CLUB_REPORTS = {
    "rpl-2026-27-r15-20261120-1630": (
        "rostov", "https://fc-rostov.ru/media/news/pobezhdaem-krylya-sovetov",
    ),
    "rpl-2026-27-r15-20261121-1000": (
        "baltika", "https://fc-baltika.ru/news/pobeda_v_orenburge/",
    ),
    "rpl-2026-27-r15-20261121-1215": (
        "akron", "https://fcakron.ru/news/2534",
    ),
    "rpl-2026-27-r15-20261121-1430": (
        "rubin", "https://www.rubin-kazan.ru/news/rubin-zenit-3-1/",
    ),
    "rpl-2026-27-r15-20261121-1645": (
        "cska", "https://pfc-cska.com/ru/novosti/vse-novosti/32787-pfk-cska-ahmat-12/",
    ),
    "rpl-2026-27-r15-20261122-1100": (
        "krasnodar", "https://www.fckrasnodar.ru/team/news/object/?object_id=154573",
    ),
    "rpl-2026-27-r15-20261122-1330": (
        "spartak",
        "https://spartak.com/matches/5f5730c0-3698-4a75-a13a-158157ea11c7/broadcast",
    ),
    "rpl-2026-27-r15-20261122-1600": (
        "lokomotiv", "https://www.fclm.ru/news/n/rodina-lokomotiv-rpl-2026-27-match-summary/",
    ),
}
assert len(CLUB_REPORTS) == len(DIRECTED) == 8
assert len({url for _, url in CLUB_REPORTS.values()}) == 8
RFS_OFFICIAL_APPOINTMENTS = "https://www.rfs.ru/news/225626"
RFS_KDK_ARCHIVE = "https://www.rfs.ru/archive?tags=16"

_SHA = re.compile(r"[a-f0-9]{64}\Z")
_REF = re.compile(r"[A-Za-z0-9_.:-]{2,160}\Z")
_ON_FIELD_EVENTS = ("KICKOFF", "HALF_TIME", "SECOND_HALF", "FULL_TIME")
_ADVERSE = frozenset({
    "TECHNICAL_AWARD", "ANNULLED", "ABANDONED",
    "REPLAY_ORDERED", "OFFICIAL_SCORE_REVISED",
})


@dataclass(frozen=True, slots=True)
class ClubReportClaim:
    """Parsed-but-unverified metadata for an exact pinned club-owned URL."""

    fixture_key: str
    publisher_club: str
    url: str
    response_sha256: str
    season: str
    round_number: int
    kickoff_at: datetime
    claimed_published_at: datetime
    observed_at: datetime
    home_club: str
    away_club: str
    home_goals: int
    away_goals: int
    events: tuple[str, ...]
    status: str


@dataclass(frozen=True, slots=True)
class KdkNoticeClaim:
    """An archive search result; NONE_FOUND never proves no future award."""

    fixture_key: str
    url: str
    response_sha256: str
    season: str
    observed_at: datetime
    disposition: str


@dataclass(frozen=True, slots=True)
class OnFieldCandidateReview:
    classification: str
    fixture_key: str
    club_digest: str | None
    kdk_digest: str | None
    club_event_claim_present: bool = False
    publisher_authenticated: bool = False
    played_final_attested: bool = False
    kdk_clearance_attested: bool = False
    settlement_authorized: bool = False
    scoring_authorized: bool = False
    model_approved: bool = False
    publication_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny(reason: str) -> None:
    raise DataError("M4-A6 private club witness: " + reason)


def _utc(value: object) -> bool:
    return (
        type(value) is datetime
        and value.tzinfo is not None
        and value.utcoffset() == timedelta(0)
    )


def _sha(value: object) -> bool:
    return type(value) is str and _SHA.fullmatch(value) is not None


def _guard_fixture(fixture: FrozenFixtureIdentity, inspected_at: datetime) -> None:
    if (
        type(fixture) is not FrozenFixtureIdentity
        or not _utc(inspected_at)
        or not _utc(fixture.kickoff_at)
        or fixture.competition != "RPL"
        or fixture.season != "2026/27"
        or type(fixture.fixture_key) is not str
        or fixture.fixture_key not in CLUB_REPORTS
        or fixture.fixture_key !=
            "rpl-2026-27-r15-" + fixture.kickoff_at.strftime("%Y%m%d-%H%M")
        or type(fixture.source_match_id) is not str
        or _REF.fullmatch(fixture.source_match_id) is None
    ):
        _deny("invalid frozen A5 fixture or caller clock")
    slot = fixture.kickoff_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    if (
        slot not in DIRECTED
        or (fixture.home_club_key, fixture.away_club_key) != DIRECTED[slot]
        or inspected_at < fixture.kickoff_at + timedelta(minutes=90)
    ):
        _deny("unverified A5 direction or postgame time")


def _guard_source(
    fixture: FrozenFixtureIdentity,
    claim: ProviderResultClaim,
    issuer: str,
    inspected_at: datetime,
) -> None:
    if (
        type(claim) is not ProviderResultClaim
        or claim.issuer != issuer
        or claim.fixture_key != fixture.fixture_key
        or claim.kickoff_at != fixture.kickoff_at
        or claim.home_club_key != fixture.home_club_key
        or claim.away_club_key != fixture.away_club_key
        or claim.season != "2026/27"
        or claim.competition != "RPL"
        or not _utc(claim.observed_at)
        or not fixture.kickoff_at + timedelta(minutes=90) <=
            claim.observed_at <= inspected_at
        or not _sha(claim.source_response_sha256)
        or type(claim.home_goals) is not int
        or type(claim.away_goals) is not int
        or not 0 <= claim.home_goals <= 20
        or not 0 <= claim.away_goals <= 20
    ):
        _deny("untrusted score/season/source claims")
    if issuer == "openfoot":
        if (
            claim.source_fixture_ref != fixture.source_match_id
            or (claim.status, claim.result_kind) not in (
                ("score_displayed_unverified", "unknown"),
                ("finished", "played"),
            )
        ):
            _deny("not an A5-linked OpenFoot score claim")
    elif (
        claim.status != "score_displayed_unverified"
        or claim.result_kind != "unknown"
        or type(claim.source_fixture_ref) is not str
        or not claim.source_fixture_ref.startswith("matchtv:")
    ):
        _deny("MatchTV calendar cannot assert played final")


def assess_club_on_field_claim(
    fixture: FrozenFixtureIdentity,
    primary: ProviderResultClaim,
    independent: ProviderResultClaim,
    club: ClubReportClaim | None,
    kdk: KdkNoticeClaim | None,
    inspected_at: datetime,
) -> OnFieldCandidateReview:
    """Compare three structural claims, NEVER authorize a final played result.

    Source authentication, first serving time and KDK completeness remain
    separate protected gates. Even a seemingly perfect 3-source agreement and
    an empty KDK search are NEVER enough to settle or score a match.
    """
    _guard_fixture(fixture, inspected_at)
    _guard_source(fixture, primary, "openfoot", inspected_at)
    _guard_source(fixture, independent, "matchtv", inspected_at)
    if (
        primary.source_response_sha256 == independent.source_response_sha256
        or (primary.home_goals, primary.away_goals) != (
            independent.home_goals, independent.away_goals
        )
    ):
        _deny("original source scores disagree")
    if club is None:
        if kdk is not None:
            _deny("KDK data cannot replace absent club report")
        return OnFieldCandidateReview(
            "PRIVATE_CLUB_REPORT_MISSING", fixture.fixture_key, None, None,
        )
    publisher, url = CLUB_REPORTS[fixture.fixture_key]
    if (
        type(club) is not ClubReportClaim
        or club.fixture_key != fixture.fixture_key
        or club.publisher_club != publisher
        or publisher not in (fixture.home_club_key, fixture.away_club_key)
        or club.url != url
        or not _sha(club.response_sha256)
        or club.response_sha256 in (
            primary.source_response_sha256, independent.source_response_sha256
        )
        or club.season != "2026/27"
        or type(club.round_number) is not int
        or club.round_number != 15
        or not _utc(club.kickoff_at)
        or club.kickoff_at != fixture.kickoff_at
        or not _utc(club.observed_at)
        or not _utc(club.claimed_published_at)
        or not fixture.kickoff_at <=
            club.claimed_published_at <= club.observed_at <= inspected_at
        or club.observed_at < fixture.kickoff_at + timedelta(minutes=90)
        or (club.home_club, club.away_club) != (
            fixture.home_club_key, fixture.away_club_key
        )
        or club.status != "MATCH_FINISHED_ON_FIELD_CLAIM"
        or club.events != _ON_FIELD_EVENTS
        or type(club.home_goals) is not int
        or type(club.away_goals) is not int
        or not 0 <= club.home_goals <= 20
        or not 0 <= club.away_goals <= 20
        or (club.home_goals, club.away_goals) != (
            primary.home_goals, primary.away_goals
        )
    ):
        _deny("club report not exact fixture/source/current-season shape")
    kdk_digest = None
    state = "PRIVATE_CLUB_REPORTED_PLAY_KDK_UNRESOLVED"
    if kdk is not None:
        if (
            type(kdk) is not KdkNoticeClaim
            or kdk.fixture_key != fixture.fixture_key
            or kdk.url != RFS_KDK_ARCHIVE
            or kdk.season != "2026/27"
            or not _sha(kdk.response_sha256)
            or kdk.response_sha256 in (
                primary.source_response_sha256,
                independent.source_response_sha256,
                club.response_sha256,
            )
            or not _utc(kdk.observed_at)
            or not club.observed_at <= kdk.observed_at <= inspected_at
            or kdk.disposition not in (
                "NONE_FOUND_UNVERIFIED", "REVIEW_PENDING", *_ADVERSE
            )
        ):
            _deny("untrusted disciplinary archive metadata")
        kdk_digest = kdk.response_sha256
        if kdk.disposition in _ADVERSE:
            state = "PRIVATE_OFFICIAL_CHANGE_BLOCKED"
    return OnFieldCandidateReview(
        state, fixture.fixture_key, club.response_sha256, kdk_digest,
        club_event_claim_present=True,
    )
