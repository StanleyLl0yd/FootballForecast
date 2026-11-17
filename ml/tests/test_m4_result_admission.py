"""Synthetic-only M4-A6 claims; no actual football results or source requests."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
    compare_provisional_played_claims,
)


def _fixture():
    return FrozenFixtureIdentity(
        fixture_key="rpl-" + "synthetic-a6-1",
        source_match_id="provider:fixture.1",
        kickoff_at=datetime(2026, 11, 20, 16, 30, tzinfo=UTC),
        home_club_key="home_club",
        away_club_key="away_club",
    )


def _claims():
    fixture = _fixture()
    common = dict(
        fixture_key=fixture.fixture_key,
        kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key,
        observed_at=fixture.kickoff_at + timedelta(hours=3),
        status="finished",
        result_kind="played",
        home_goals=2,
        away_goals=1,
    )
    first = ProviderResultClaim(
        issuer="openfoot",
        source_fixture_ref="provider:fixture.1",
        source_response_sha256="a" * 64,
        **common,
    )
    other = ProviderResultClaim(
        issuer="matchtv",
        source_fixture_ref="independent:fixture.1",
        source_response_sha256="b" * 64,
        **common,
    )
    return first, other


def _compare(fixture=None, primary=None, corroboration=None, inspected_at=None):
    a, b = _claims()
    return compare_provisional_played_claims(
        fixture if fixture is not None else _fixture(),
        primary if primary is not None else a,
        corroboration if corroboration is not None else b,
        inspected_at if inspected_at is not None
        else datetime(2026, 11, 21, tzinfo=UTC),
    )


def test_synthetic_agreement_is_never_result_attestation_or_authorization():
    candidate = _compare()
    assert candidate.classification == "PRIVATE_RESULT_CANDIDATE_UNATTESTED"
    assert (candidate.home_goals, candidate.away_goals) == (2, 1)
    assert candidate.fixture_key == _fixture().fixture_key
    assert candidate.primary_sha256 == "a" * 64
    assert candidate.corroboration_sha256 == "b" * 64
    for flag in (
        "source_time_attested",
        "independent_played_final_attested",
        "settlement_authorized",
        "publication_authorized",
        "holdout_2025_26_read",
    ):
        assert getattr(candidate, flag) is False


@pytest.mark.parametrize(
    "part,changes",
    [
        ("primary", {"issuer": "matchtv"}),
        ("corroboration", {"issuer": "openfoot"}),
        ("corroboration", {"source_response_sha256": "a" * 64}),
        ("primary", {"source_response_sha256": "Z" * 64}),
        ("primary", {"source_fixture_ref": "../../unsafe?x=1"}),
        ("primary", {"source_fixture_ref": "../unsafe"}),
        ("primary", {"source_fixture_ref": "wrong:match.id"}),
        ("primary", {"fixture_key": "rpl-synthetic-another"}),
        ("primary", {"kickoff_at": datetime(2026, 11, 20, 17, tzinfo=UTC)}),
        ("primary", {"home_club_key": "away_club"}),
        ("primary", {"away_club_key": "home_club"}),
        ("primary", {"competition": "OTHER"}),
        ("primary", {"season": "2025/26"}),
        ("primary", {"status": "awarded"}),
        ("primary", {"status": "postponed"}),
        ("primary", {"status": "abandoned"}),
        ("primary", {"status": "live"}),
        ("primary", {"result_kind": "technical"}),
        ("primary", {"result_kind": "disciplinary"}),
        ("corroboration", {"home_goals": 3}),
        ("corroboration", {"away_goals": 0}),
        ("primary", {"home_goals": -1}),
        ("primary", {"away_goals": 21}),
        ("primary", {"home_goals": True}),
        ("primary", {"observed_at": datetime(2026, 11, 20, 17, 59, tzinfo=UTC)}),
        ("primary", {"observed_at": datetime(2026, 11, 21, 1, tzinfo=UTC)}),
        ("primary", {"observed_at": datetime(2026, 11, 20, 20, 0)}),
        ("primary", {"observed_at": datetime(
            2026, 11, 20, 19, 30, tzinfo=timezone(timedelta(hours=1))
        )}),
    ],
)
def test_false_independence_technical_or_inconsistent_claims_refused(part, changes):
    a, b = _claims()
    if part == "primary":
        a = replace(a, **changes)
    else:
        b = replace(b, **changes)
    with pytest.raises(DataError):
        _compare(primary=a, corroboration=b)


@pytest.mark.parametrize(
    "changes",
    [
        {"fixture_key": "external"},
        {"fixture_key": "rpl-" + "Synthetic-A6"},
        {"source_match_id": "wrong:match.id"},
        {"source_match_id": "../unsafe"},
        {"kickoff_at": datetime(2025, 11, 20, 16, 30, tzinfo=UTC)},
        {"kickoff_at": datetime(2026, 11, 10, 16, 30, tzinfo=UTC)},
        {"kickoff_at": datetime(2027, 7, 1, tzinfo=UTC)},
        {"home_club_key": "away_club"},
        {"home_club_key": "UNTRUSTED"},
        {"season": "2025/26"},
        {"competition": "PL"},
    ],
)
def test_only_m4_prospective_anchor_shape_allowed(changes):
    with pytest.raises(DataError):
        _compare(fixture=replace(_fixture(), **changes))


def test_early_inspection_rejected():
    with pytest.raises(DataError):
        _compare(inspected_at=datetime(2026, 11, 20, 18, tzinfo=UTC))


def test_no_io_or_automatic_settlement_boundary():
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[1]
        / "src/football_forecast/evaluation/m4_result_admission.py"
    )
    source = path.read_text(encoding="utf-8")
    for forbidden in (
        "requests.get",
        "psycopg.connect",
        "public.ff_forecasts",
        "write_text(",
        "2025/26 holdout",
    ):
        assert forbidden not in source
