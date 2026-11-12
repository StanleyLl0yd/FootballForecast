"""Synthetic-only M4 future fixture source: fail-closed read-only contract."""
from datetime import UTC, datetime, timedelta
from json import dumps

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_source import (
    CALENDAR,
    COMPETITION,
    FIRST_KICKOFF,
    M4_START,
    inspect_future_rpl_source,
)


def _pages():
    docs = {}
    next_id = 0
    for day, hours in CALENDAR.items():
        matches = []
        for time in hours:
            next_id += 1
            matches.append({
                "id": f"synthetic_rpl_{next_id}",
                "competitionId": COMPETITION,
                "season": "2026/27",
                "status": "scheduled",
                "kickoffAt": f"{day}T{time}:00.000Z",
                "homeTeam": {
                    "id": f"team_home_{next_id}",
                    "name": f"Fictional Home {next_id}",
                },
                "awayTeam": {
                    "id": f"team_away_{next_id}",
                    "name": f"Fictional Away {next_id}",
                },
                "score": None,
            })
        docs[day] = {
            "data": matches,
            "meta": {
                "count": len(matches),
                "access": {"authenticated": True, "plan": "starter"},
            },
        }
    return docs


def _encode(doc):
    return {key: dumps(value, separators=(",", ":")).encode()
            for key, value in doc.items()}


def _check(doc):
    return inspect_future_rpl_source(
        _encode(doc), datetime(2026, 11, 11, 17, 0, tzinfo=UTC)
    )


def test_strict_synthetic_complete_three_day_round_is_not_an_approved_forecast():
    receipt = _check(_pages())
    assert receipt.days == 3
    assert receipt.fixtures == 8
    assert receipt.club_identities == 16
    assert receipt.classification == "UNAPPROVED_PRIVATE_FUTURE_SOURCE_OBSERVATION"
    assert receipt.observation_completed_utc == "2026-11-11T17:00:00Z"
    assert len(receipt.source_envelopes_sha256) == 64
    for flag in (
        receipt.independent_source_confirmed,
        receipt.genuine_as_of_attested,
        receipt.model_approved,
        receipt.forecast_written,
        receipt.public_forecasts_written,
        receipt.holdout_2025_26_read,
    ):
        assert flag is False
    assert receipt.private_shadow_only is True
    assert not hasattr(receipt, "team_ids")
    assert not hasattr(receipt, "source_matches")


@pytest.mark.parametrize(("field","value"), [
    ("season", "2025/26"),
    ("season", "2024/25"),
    ("status", "finished"),
    ("status", "awarded"),
    ("competitionId", "comp_premier_league_eng"),
    ("kickoffAt", "2026-11-21T14:31:00.000Z"),
    ("kickoffAt", "2026-11-21T17:30:00+03:00"),
])
def test_refuses_sealed_wrong_season_finished_awarded_and_schedule_drift(field, value):
    docs = _pages()
    docs["2026-11-21"]["data"][0][field] = value
    with pytest.raises(DataError):
        _check(docs)


def test_refuses_missing_extra_dates_noncomplete_round_and_duplicated_ids():
    docs = _pages()
    docs.pop("2026-11-22")
    with pytest.raises(DataError):
        _check(docs)
    docs = _pages()
    docs["2026-11-21"]["data"].pop()
    with pytest.raises(DataError):
        _check(docs)
    docs = _pages()
    docs["2026-11-22"]["data"][0]["id"] = docs["2026-11-21"]["data"][0]["id"]
    with pytest.raises(DataError):
        _check(docs)


def test_no_duplicate_club_assignment_or_results_before_kickoff():
    docs = _pages()
    docs["2026-11-20"]["data"][0]["awayTeam"]["id"] = (
        docs["2026-11-20"]["data"][0]["homeTeam"]["id"]
    )
    with pytest.raises(DataError):
        _check(docs)
    docs = _pages()
    docs["2026-11-20"]["data"][0]["score"] = {"home": 1, "away": 0}
    with pytest.raises(DataError):
        _check(docs)


def test_refuses_unauthenticated_source_paginated_or_tampered_envelope():
    docs = _pages()
    docs["2026-11-21"]["meta"]["access"]["authenticated"] = False
    with pytest.raises(DataError):
        _check(docs)
    docs = _pages()
    docs["2026-11-21"]["meta"]["count"] = 999
    with pytest.raises(DataError):
        _check(docs)
    data = _encode(_pages())
    data["2026-11-21"] = b'{"data":[],"data":[]}'
    with pytest.raises(DataError):
        inspect_future_rpl_source(data, datetime(2026,11,11,17,tzinfo=UTC))


def test_no_backdating_observation_or_post_kickoff_attestation():
    raw = _encode(_pages())
    for now in (
        M4_START,
        M4_START - timedelta(seconds=1),
        FIRST_KICKOFF - timedelta(seconds=899),
        FIRST_KICKOFF,
        datetime(2026,11,11,17,0),
    ):
        with pytest.raises(DataError):
            inspect_future_rpl_source(raw, now)


def test_response_digest_detects_even_valid_nonsemantic_source_revision():
    docs = _pages()
    original = _check(docs)
    docs["2026-11-20"]["meta"]["request_id"] = "synthetic-revision"
    revised = _check(docs)
    assert original.source_envelopes_sha256 != revised.source_envelopes_sha256


def test_no_unreviewed_io_or_public_api_in_source_validator():
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "src" / (
        "football_forecast/research/m4_future_rpl_source.py"
    )
    text = path.read_text(encoding="utf-8")
    for forbidden in ("urllib.request", "requests.get", "psycopg.connect",
                      "public.ff_forecasts", "2025/26'", "predict("):
        assert forbidden not in text
