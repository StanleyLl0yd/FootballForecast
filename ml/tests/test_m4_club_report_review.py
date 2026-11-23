"""Synthetic-only pinned 2026/27 official club reports; no real result claims."""
from dataclasses import fields, replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    CLUB_REPORTS,
    RFS_KDK_ARCHIVE,
    ClubReportClaim,
    KdkNoticeClaim,
    assess_club_on_field_claim,
)
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED

KICKOFF = datetime(2026, 11, 21, 14, 30, tzinfo=UTC)
NOW = datetime(2026, 11, 23, 11, 0, tzinfo=UTC)
KEY = "rpl-2026-27-r15-20261121-1430"


def _fixture():
    return FrozenFixtureIdentity(
        fixture_key=KEY,
        source_match_id="test:provider.match",
        kickoff_at=KICKOFF,
        home_club_key="rubin",
        away_club_key="zenit",
    )


def _claim(issuer, digest, goals=(3, 1)):
    return ProviderResultClaim(
        issuer=issuer,
        source_fixture_ref=(
            "test:provider.match" if issuer == "openfoot" else "matchtv:552665047"
        ),
        fixture_key=KEY,
        kickoff_at=KICKOFF,
        home_club_key="rubin",
        away_club_key="zenit",
        observed_at=NOW - timedelta(minutes=4),
        source_response_sha256=digest * 64,
        status="score_displayed_unverified",
        result_kind="unknown",
        home_goals=goals[0],
        away_goals=goals[1],
    )


def _club():
    return ClubReportClaim(
        fixture_key=KEY,
        publisher_club="rubin",
        url=CLUB_REPORTS[KEY][1],
        response_sha256="c" * 64,
        season="2026/27",
        round_number=15,
        kickoff_at=KICKOFF,
        claimed_published_at=KICKOFF + timedelta(hours=3),
        observed_at=NOW - timedelta(minutes=2),
        home_club="rubin",
        away_club="zenit",
        home_goals=3,
        away_goals=1,
        events=("KICKOFF", "HALF_TIME", "SECOND_HALF", "FULL_TIME"),
        status="MATCH_FINISHED_ON_FIELD_CLAIM",
    )


def _kdk(disposition="NONE_FOUND_UNVERIFIED"):
    return KdkNoticeClaim(
        fixture_key=KEY,
        url=RFS_KDK_ARCHIVE,
        response_sha256="d" * 64,
        season="2026/27",
        observed_at=NOW - timedelta(minutes=1),
        disposition=disposition,
    )


def _assess(fixture=None, primary=None, independent=None, club=None, kdk=None):
    return assess_club_on_field_claim(
        fixture or _fixture(),
        primary or _claim("openfoot", "a"),
        independent or _claim("matchtv", "b"),
        club or _club(),
        kdk,
        NOW,
    )


def test_eight_exact_current_season_club_owned_urls_predeclared():
    assert len(CLUB_REPORTS) == len(DIRECTED) == 8
    assert len({url for _, url in CLUB_REPORTS.values()}) == 8
    for kickoff, (home, away) in DIRECTED.items():
        event = datetime.fromisoformat(kickoff.replace("Z", "+00:00"))
        key = "rpl-2026-27-r15-" + event.strftime("%Y%m%d-%H%M")
        publisher, url = CLUB_REPORTS[key]
        assert publisher in (home, away)
        assert url.startswith("https://")
        assert "2025/26" not in url
        assert "head-to-head" not in url


def test_pinned_club_source_registry_cannot_be_mutated():
    with pytest.raises(TypeError):
        CLUB_REPORTS[KEY] = ("fake", "https://attacker.example/match")


def test_three_matching_public_score_shapes_still_never_authorize_scoring():
    r = _assess()
    assert r.classification == "PRIVATE_CLUB_REPORTED_PLAY_KDK_UNRESOLVED"
    assert r.fixture_key == KEY
    assert r.club_digest == "c" * 64
    assert r.kdk_digest is None
    assert r.club_event_claim_present is True
    for name in (
        "publisher_authenticated",
        "played_final_attested",
        "kdk_clearance_attested",
        "settlement_authorized",
        "scoring_authorized",
        "model_approved",
        "publication_authorized",
        "holdout_2025_26_read",
    ):
        assert getattr(r, name) is False


def test_absent_club_report_does_not_manufacture_evidence():
    r = assess_club_on_field_claim(
        _fixture(), _claim("openfoot", "a"), _claim("matchtv", "b"),
        None, None, NOW,
    )
    assert r.classification == "PRIVATE_CLUB_REPORT_MISSING"
    assert r.club_digest is None
    assert r.played_final_attested is False
    assert r.settlement_authorized is False


@pytest.mark.parametrize("decision", [
    "NONE_FOUND_UNVERIFIED", "REVIEW_PENDING",
])
def test_absent_or_undocumented_kdk_result_never_equals_clearance(decision):
    r = _assess(kdk=_kdk(decision))
    assert r.classification == "PRIVATE_CLUB_REPORTED_PLAY_KDK_UNRESOLVED"
    assert r.kdk_digest == "d" * 64
    assert r.kdk_clearance_attested is False
    assert r.settlement_authorized is False


@pytest.mark.parametrize("decision", [
    "TECHNICAL_AWARD",
    "ANNULLED",
    "ABANDONED",
    "REPLAY_ORDERED",
    "OFFICIAL_SCORE_REVISED",
])
def test_technical_awarded_or_revised_official_status_blocks(decision):
    r = _assess(kdk=_kdk(decision))
    assert r.classification == "PRIVATE_OFFICIAL_CHANGE_BLOCKED"
    assert r.scoring_authorized is False
    assert r.played_final_attested is False


@pytest.mark.parametrize(("attr", "value"), [
    ("fixture_key", "rpl-wrong"),
    ("publisher_club", "zenit"),
    ("url", "https://attacker.example/football"),
    ("url", "http://www.rubin-kazan.ru/news/rubin-zenit-3-1/"),
    ("url", "https://www.rubin-kazan.ru/news/rubin-zenit-3-1/?old=1"),
    ("response_sha256", "c" * 63),
    ("response_sha256", "a" * 64),
    ("season", "2025/26"),
    ("round_number", True),
    ("round_number", 14),
    ("kickoff_at", KICKOFF + timedelta(minutes=1)),
    ("home_club", "zenit"),
    ("away_club", "rubin"),
    ("home_goals", 2),
    ("home_goals", True),
    ("away_goals", -1),
    ("events", ("KICKOFF", "FULL_TIME")),
    ("events", ("FULL_TIME", "KICKOFF")),
    ("status", "TECHNICAL_AWARD"),
    ("claimed_published_at", KICKOFF - timedelta(seconds=1)),
    ("claimed_published_at", NOW + timedelta(days=1)),
    ("observed_at", KICKOFF + timedelta(minutes=89)),
    ("observed_at", NOW + timedelta(seconds=1)),
    ("observed_at", NOW.replace(tzinfo=None)),
])
def test_club_report_untrusted_identity_time_or_score_rejected(attr, value):
    with pytest.raises(DataError):
        _assess(club=replace(_club(), **{attr: value}))


@pytest.mark.parametrize(("attr", "value"), [
    ("source_url", "skip"),
])
def test_record_has_no_dynamic_url_resolution(attr, value):
    # No untrusted caller link can replace an exact host/URL pin.
    assert attr not in {f.name for f in fields(ClubReportClaim)}
    assert value not in CLUB_REPORTS[KEY][1]


@pytest.mark.parametrize(("part", "changes"), [
    ("fixture", {"season": "2025/26"}),
    ("fixture", {"fixture_key": "rpl-another"}),
    ("fixture", {"source_match_id": "../bad"}),
    ("fixture", {"home_club_key": "zenit"}),
    ("fixture", {"away_club_key": "rubin"}),
    ("fixture", {"kickoff_at": KICKOFF + timedelta(hours=1)}),
    ("primary", {"source_fixture_ref": "wrong:provider"}),
    ("primary", {"home_goals": 0}),
    ("primary", {"result_kind": "technical"}),
    ("primary", {"observed_at": KICKOFF}),
    ("independent", {"status": "finished", "result_kind": "played"}),
    ("independent", {"source_response_sha256": "a" * 64}),
    ("independent", {"source_fixture_ref": "matchtv:wrong"}),
    ("independent", {"away_goals": 2}),
    ("independent", {"season": "2025/26"}),
])
def test_a5_or_two_original_sources_cannot_be_spoofed(part, changes):
    values = {
        "fixture": _fixture(),
        "primary": _claim("openfoot", "a"),
        "independent": _claim("matchtv", "b"),
    }
    values[part] = replace(values[part], **changes)
    with pytest.raises(DataError):
        _assess(**values)


@pytest.mark.parametrize(("attr", "value"), [
    ("fixture_key", "other"),
    ("source_url", "other"),
    ("url", "https://attacker.example"), 
])
def test_disciplined_source_fields_deny_unpinned_or_mutated(attr, value):
    kdk = _kdk()
    if hasattr(kdk, attr):
        with pytest.raises(DataError):
            _assess(kdk=replace(kdk, **{attr: value}))
    else:
        assert attr not in {field.name for field in fields(KdkNoticeClaim)}


@pytest.mark.parametrize(("attr", "value"), [
    ("response_sha256", "a" * 64),
    ("season", "2025/26"),
    ("observed_at", KICKOFF),
    ("disposition", "APPROVED_CLEAR"),
    ("disposition", "NO_SANCTIONS"),
    ("disposition", ["TECHNICAL_AWARD"]),
])
def test_false_kdk_clearance_claim_refused(attr, value):
    with pytest.raises(DataError):
        _assess(kdk=replace(_kdk(), **{attr: value}))


def test_missing_club_with_kdk_cannot_advance():
    with pytest.raises(DataError):
        assess_club_on_field_claim(
            _fixture(), _claim("openfoot", "a"), _claim("matchtv", "b"),
            None, _kdk(), NOW,
        )


def test_no_network_database_scoring_or_exporting_sealed_holdout():
    from pathlib import Path

    path = (Path(__file__).resolve().parents[1] /
            "src/football_forecast/evaluation/m4_club_report_review.py")
    text = path.read_text(encoding="utf-8")
    for forbidden in (
        "requests.get", "urllib.request", "psycopg.connect", "public.ff_forecasts",
        "2025/26?", "SELECT *", "write_text(", "httpx.get",
    ):
        assert forbidden not in text
