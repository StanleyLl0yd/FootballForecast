"""Synthetic practical A6 evidence claims; no external source or DB reads."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    CLUB_REPORTS,
    MATCH_PROTOCOL_REFERENCES,
    SECOND_CLUB_REPORTS,
    DirectedGoalClaim,
    OfficialReportClaim,
    assess_practical_result_claims,
)
from football_forecast.evaluation.m4_postmatch_sources import MATCHTV_MATCH_IDS
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED

NOW = datetime(2026, 11, 24, 12, tzinfo=UTC)
EVENTS = ("KICKOFF", "HALF_TIME", "SECOND_HALF", "FULL_TIME")


def _case(slot="2026-11-21T12:15:00Z", score=(1, 2), protocol=False):
    kickoff = datetime.fromisoformat(slot)
    key = "rpl-2026-27-r15-" + kickoff.strftime("%Y%m%d-%H%M")
    home, away = DIRECTED[slot]
    fixture = FrozenFixtureIdentity(key, "synthetic:fixture", kickoff, home, away)
    common = dict(
        fixture_key=key, kickoff_at=kickoff, home_club_key=home,
        away_club_key=away, observed_at=kickoff + timedelta(hours=3),
        home_goals=score[0], away_goals=score[1],
        status="score_displayed_unverified", result_kind="unknown",
    )
    first = ProviderResultClaim(
        issuer="openfoot", source_fixture_ref=fixture.source_match_id,
        source_response_sha256="a" * 64, **common,
    )
    other = ProviderResultClaim(
        issuer="matchtv", source_fixture_ref="matchtv:" + MATCHTV_MATCH_IDS[key],
        source_response_sha256="b" * 64, **common,
    )
    goals = tuple(
        [DirectedGoalClaim(home, n + 1, 0) for n in range(score[0])]
        + [DirectedGoalClaim(away, score[0], n + 1) for n in range(score[1])]
    )
    if protocol:
        number, url = MATCH_PROTOCOL_REFERENCES[key]
        pins = (("rpl_protocol:" + number, url),)
    else:
        pins = (CLUB_REPORTS[key], SECOND_CLUB_REPORTS[key])
    witnesses = tuple(
        OfficialReportClaim(
            key, publisher, url, digest * 64, fixture.season, 15, kickoff,
            kickoff + timedelta(hours=4), home, away, *score, EVENTS, goals,
        )
        for (publisher, url), digest in zip(pins, "cd", strict=False)
    )
    return fixture, first, other, witnesses


def _assess(case=None):
    return assess_practical_result_claims(*(_case() if case is None else case), NOW)


def _mutate(**changes):
    f, a, b, w = _case()
    return f, a, b, (replace(w[0], **changes), w[1])


def _assert_no_authority(review):
    for flag in (
        "publisher_authenticated", "played_final_attested", "kdk_clearance_attested",
        "settlement_authorized", "scoring_authorized", "model_approved",
        "publication_authorized", "holdout_2025_26_read",
    ):
        assert getattr(review, flag) is False


def test_two_official_claims_are_candidate_only_and_known_kdk_pending():
    result = _assess()
    assert result.evidence_route == "OPPOSING_CLUB_REPORTS"
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_PENDING"
    _assert_no_authority(result)


def test_protocol_reference_alternative_does_not_require_publisher_signature():
    result = _assess(_case("2026-11-22T13:30:00Z", protocol=True))
    assert result.evidence_route == "PROTOCOL_REFERENCE"
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_UNREVIEWED"
    _assert_no_authority(result)


def test_no_agenda_listing_does_not_prove_clearance():
    result = _assess(_case("2026-11-20T16:30:00Z", score=(0, 0)))
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_UNREVIEWED"
    _assert_no_authority(result)


@pytest.mark.parametrize("changes", [
    {"season": "2025/26"},
    {"round_number": True},
    {"publisher": "unknown"},
    {"url": "https://attacker.example/report"},
    {"response_sha256": "a" * 64},
    {"response_sha256": "d" * 64},
    {"home_club": "fakel"},
    {"away_goals": True},
    {"events": ("KICKOFF", "FULL_TIME")},
    {"goals": ()},
    {"goals": (DirectedGoalClaim("akron", 1, 0),
               DirectedGoalClaim("fakel", 2, 0),
               DirectedGoalClaim("fakel", 3, 0))},
    {"goals": (DirectedGoalClaim("unknown", 1, 0),
               DirectedGoalClaim("fakel", 1, 1),
               DirectedGoalClaim("fakel", 1, 2))},
    {"goals": (DirectedGoalClaim("akron", True, 0),
               DirectedGoalClaim("fakel", 1, 1),
               DirectedGoalClaim("fakel", 1, 2))},
    {"observed_at": NOW + timedelta(seconds=1)},
])
def test_invalid_or_contradictory_semantics_fail_closed(changes):
    with pytest.raises(DataError):
        _assess(_mutate(**changes))


def test_two_valid_but_different_goal_sequences_are_not_corroborated():
    with pytest.raises(DataError):
        _assess(_mutate(goals=(
            DirectedGoalClaim("fakel", 0, 1),
            DirectedGoalClaim("akron", 1, 1),
            DirectedGoalClaim("fakel", 1, 2),
        )))


def test_same_publisher_twice_or_one_club_cannot_replace_official_pair():
    f, a, b, w = _case()
    for invalid in ((w[0], w[0]), (w[0],), (), (w[0], w[1], w[1])):
        with pytest.raises(DataError):
            _assess((f, a, b, invalid))


def test_known_pending_does_not_expire_automatically_after_hearing():
    case = _case()
    result = assess_practical_result_claims(*case, NOW + timedelta(days=10))
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_PENDING"
    _assert_no_authority(result)


def test_two_sources_must_still_agree_and_technical_claim_refused():
    f, a, b, w = _case()
    for invalid in (replace(a, result_kind="technical"), replace(a, away_goals=0)):
        with pytest.raises(DataError):
            _assess((f, invalid, b, w))
