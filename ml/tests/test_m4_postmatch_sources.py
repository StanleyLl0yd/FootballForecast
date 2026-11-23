"""Synthetic-only A6 parsing and identity refusal; no HTTP/DB/live scores."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import dumps

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    compare_provisional_played_claims,
)
from football_forecast.evaluation.m4_postmatch_sources import (
    A5PostmatchAnchor,
    MATCHTV_MATCH_IDS,
    MATCHTV_PATHS,
    parse_matchtv_result_candidate,
    parse_openfoot_result_candidate,
)

KICKOFF = datetime(2026, 11, 21, 14, 30, tzinfo=UTC)
OBSERVED = datetime(2026, 11, 23, 8, 0, tzinfo=UTC)


def _anchor(*, fixture_changes=None, **changes):
    fixture = FrozenFixtureIdentity(
        fixture_key="rpl-" + "2026-27-r15-20261121-1430",
        source_match_id="match:synthetic.rubin-zenit",
        kickoff_at=KICKOFF,
        home_club_key="rubin",
        away_club_key="zenit",
    )
    return replace(A5PostmatchAnchor(
        fixture=replace(fixture, **(fixture_changes or {})),
        home_provider_id="provider:rubin",
        away_provider_id="provider:zenit",
    ), **changes)


def _openfoot_row():
    return {
        "id": "match:synthetic.rubin-zenit",
        "competitionId": "comp_premier_league_rus",
        "season": "2026/27",
        "kickoffAt": "2026-11-21T14:30:00Z",
        "status": "finished",
        "resultKind": "played",
        "score": {"home": 3, "away": 1},
        "homeTeam": {"id": "provider:rubin", "name": "Рубин Казань"},
        "awayTeam": {"id": "provider:zenit", "name": "Зенит Санкт-Петербург"},
    }


def _openfoot_blob(row=None, *, authenticated=True, count=1):
    return dumps({
        "data": [row if row is not None else _openfoot_row()],
        "meta": {"count": count, "access": {"authenticated": authenticated}},
    }, ensure_ascii=False, separators=(",", ":")).encode()


def _matchtv_blob(title="Рубин (Казань) — Зенит (Санкт-Петербург)",
                  score="3:1", status="Завершён",
                  kickoff="21 нояб, 17:30", extra=""):
    return (
        '<html><body><h1>' + title + '</h1>'
        '<a>Альфа-Банк Российская Премьер-Лига, Тур 15</a>'
        '<div>Рубин Казань</div><p>' + status + '</p>'
        '<div>' + score + '</div><div>' + kickoff + '</div>'
        '<div>Зенит Санкт-Петербург</div>' + extra +
        '<h2>Прошлые матчи</h2>' + ('0:0 2025/26 ' * 100) +
        '</body></html>'
    ).encode()


def _parsed():
    a = _anchor()
    openfoot = _openfoot_blob()
    matchtv = _matchtv_blob()
    return (
        parse_openfoot_result_candidate(openfoot, a, OBSERVED),
        parse_matchtv_result_candidate(matchtv, a, OBSERVED),
    )


def test_two_realistic_synthetic_sources_agree_but_remain_unattested():
    source, independent = _parsed()
    assert source.source_fixture_ref == _anchor().fixture.source_match_id
    assert independent.source_fixture_ref == "matchtv:552665047"
    assert (source.home_goals, source.away_goals) == (3, 1)
    assert (independent.home_goals, independent.away_goals) == (3, 1)
    assert source.source_response_sha256 == sha256(_openfoot_blob()).hexdigest()
    assert independent.source_response_sha256 == sha256(_matchtv_blob()).hexdigest()
    candidate = compare_provisional_played_claims(
        _anchor().fixture, source, independent, OBSERVED,
    )
    assert candidate.classification == "PRIVATE_RESULT_CANDIDATE_UNATTESTED"
    assert candidate.source_time_attested is False
    assert candidate.independent_played_final_attested is False
    assert candidate.settlement_authorized is False
    assert candidate.publication_authorized is False
    assert candidate.holdout_2025_26_read is False


@pytest.mark.parametrize("change", [
    {"id": "other-fixture"},
    {"competitionId": "other"},
    {"season": "2025/26"},
    {"kickoffAt": "2026-11-21T14:45:00Z"},
    {"status": "live"},
    {"status": "postponed"},
    {"status": "awarded"},
    {"resultKind": "technical"},
    {"resultKind": None},
    {"awarded": True},
    {"technical": True},
    {"walkover": True},
    {"abandoned": True},
    {"score": None},
    {"score": {"home": 3, "away": 1, "penalties": "5:4"}},
    {"score": {"home": True, "away": 1}},
    {"score": {"home": 21, "away": 1}},
    {"score": {"home": -1, "away": 1}},
    {"homeTeam": {"id": "provider:rubin", "name": "Зенит"}},
    {"homeTeam": {"id": "wrong-team", "name": "Рубин"}},
    {"awayTeam": {"id": "wrong-team", "name": "Зенит"}},
])
def test_openfoot_rejects_all_unverified_technical_or_wrong_id_forms(change):
    with pytest.raises(DataError):
        parse_openfoot_result_candidate(
            _openfoot_blob(_openfoot_row() | change), _anchor(), OBSERVED,
        )


@pytest.mark.parametrize("override", [
    {"authenticated": False},
    {"count": 2},
])
def test_openfoot_envelope_must_be_one_authenticated_exact_match(override):
    with pytest.raises(DataError):
        parse_openfoot_result_candidate(
            _openfoot_blob(**override), _anchor(), OBSERVED,
        )


@pytest.mark.parametrize("change", [
    {"title": "Зенит — Рубин"},
    {"title": "Рубин — Динамо М"},
    {"title": "Рубин — Рубин"},
    {"score": "-:-"},
    {"score": "3:0"},
    {"score": "30:1"},
    {"status": "Не начался"},
    {"status": "Отменён"},
    {"kickoff": "21 нояб, 17:31"},
    {"kickoff": "20 нояб, 17:30"},
    {"extra": "<div>Матч завершён технической победой</div>"},
    {"extra": "<div>Окончательный результат присуждён</div>"},
])
def test_matchtv_rejects_wrong_status_direction_time_award_or_score(change):
    with pytest.raises(DataError):
        parse_matchtv_result_candidate(_matchtv_blob(**change), _anchor(), OBSERVED)


def test_matchtv_historical_h2h_goals_cannot_be_misread_as_current():
    invalid = _matchtv_blob(status="Не начался", score="-:-")
    assert b"2025/26" in invalid
    with pytest.raises(DataError):
        parse_matchtv_result_candidate(invalid, _anchor(), OBSERVED)


@pytest.mark.parametrize("body", [
    b"<html><h1>Рубин - Зенит</h1><div>Завершён 3:1</div></html>",
    b"x" * 8_000_001,
    b"\xff" * 1024,
])
def test_matchtv_rejects_invalid_or_bounded_html(body):
    with pytest.raises(DataError):
        parse_matchtv_result_candidate(body, _anchor(), OBSERVED)


@pytest.mark.parametrize("fixture_changes", [
    {"source_match_id": "other-match"},
    {"fixture_key": "rpl-another"},
    {"season": "2025/26"},
    {"competition": "CUP"},
    {"kickoff_at": datetime(2026, 11, 21, 15, tzinfo=UTC)},
    {"home_club_key": "zenit"},
    {"away_club_key": "rubin"},
])
def test_openfoot_a5_identity_anchor_tampering_is_denied(fixture_changes):
    with pytest.raises(DataError):
        parse_openfoot_result_candidate(
            _openfoot_blob(), _anchor(fixture_changes=fixture_changes), OBSERVED,
        )


def test_untrusted_local_clock_and_early_postgame_denied():
    for observed in (
        KICKOFF + timedelta(minutes=30),
        OBSERVED.replace(tzinfo=None),
        OBSERVED.astimezone(timedelta(hours=3)),  # validated below for tz type
    ):
        if not isinstance(observed, datetime):
            continue
        with pytest.raises((DataError, TypeError)):
            parse_openfoot_result_candidate(_openfoot_blob(), _anchor(), observed)


def test_two_distinct_pinned_matchtv_paths_for_each_direction():
    assert len(MATCHTV_MATCH_IDS) == len(MATCHTV_PATHS) == 8
    assert len(set(MATCHTV_MATCH_IDS.values())) == 8
    assert all(path.startswith("/football/rpl/" + match_id + "-")
               for match_id, path in MATCHTV_PATHS.items())


def test_no_network_database_or_public_prediction_side_effects():
    from pathlib import Path

    path = (Path(__file__).resolve().parents[1] /
            "src/football_forecast/evaluation/m4_postmatch_sources.py")
    source = path.read_text()
    for forbidden in ("psycopg.connect", "urllib.request", "requests.get",
                      "public.ff_forecasts", "openfootapi.com/v1", "2025/26 holdout"):
        assert forbidden not in source
