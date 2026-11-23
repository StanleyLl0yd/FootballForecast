"""Synthetic-only A6 parsing and identity refusal; no HTTP/DB/live scores."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta, timezone
from hashlib import sha256
from json import dumps

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_postmatch_sources import (
    MATCHTV_MATCH_IDS,
    A5PostmatchAnchor,
    parse_matchtv_result_candidate,
    parse_openfoot_result_candidate,
)
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    compare_provisional_played_claims,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED
from football_forecast.research.m4_future_rpl_independent import (
    MATCHTV_DAYS,
    MATCHTV_NAMES,
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


def _matchtv_blob():
    known = {
        "2026-11-20T16:30:00Z": (3, 0),
        "2026-11-21T10:00:00Z": (0, 2),
        "2026-11-21T12:15:00Z": (0, 2),
        "2026-11-21T14:30:00Z": (3, 1),
        "2026-11-21T16:45:00Z": (1, 2),
        "2026-11-22T11:00:00Z": (1, 1),
        "2026-11-22T13:30:00Z": (1, 1),
        "2026-11-22T16:00:00Z": (0, 1),
    }
    rows = ["<h3>Тур 15</h3>"]
    for marker, day in MATCHTV_DAYS:
        rows.append("<h4>" + marker + "</h4>")
        for kickoff, (home, away) in DIRECTED.items():
            if not kickoff.startswith(day):
                continue
            h, a = known[kickoff]
            rows.append(
                "<a>" + MATCHTV_NAMES[home] + " " + str(h) + " " +
                MATCHTV_NAMES[away] + " " + str(a) + "</a>"
            )
    return ("<html><body>" + "".join(rows) + "<h3>Тур 16</h3>" +
            "x" * 2048 + "</body></html>").encode()


def _parsed():
    a = _anchor()
    openfoot = _openfoot_blob()
    matchtv = _matchtv_blob()
    return (
        parse_openfoot_result_candidate(openfoot, a, OBSERVED),
        parse_matchtv_result_candidate(matchtv, a, OBSERVED),
    )


def test_two_synthetic_score_claims_never_prove_independent_played_final():
    source, independent = _parsed()
    assert source.source_fixture_ref == _anchor().fixture.source_match_id
    assert independent.source_fixture_ref == "matchtv:552665047"
    assert (source.home_goals, source.away_goals) == (3, 1)
    assert (independent.home_goals, independent.away_goals) == (3, 1)
    assert source.source_response_sha256 == sha256(_openfoot_blob()).hexdigest()
    assert independent.source_response_sha256 == sha256(_matchtv_blob()).hexdigest()
    assert source.status == "finished"
    assert source.result_kind == "played"
    assert independent.status == "score_displayed_unverified"
    assert independent.result_kind == "unknown"
    # Identical scores are NEVER grounds to fabricate MatchTV played-final.
    with pytest.raises(DataError):
        compare_provisional_played_claims(
            _anchor().fixture, source, independent, OBSERVED,
        )

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


@pytest.mark.parametrize("before,after", [
    ("Рубин 3 Зенит 1", "Зенит 1 Рубин 3"),
    ("Рубин 3 Зенит 1", "Рубин Зенит 17:30"),
    ("Рубин 3 Зенит 1", "Рубин 30 Зенит 1"),
    ("Рубин 3 Зенит 1", "Рубин 3 Зенит 1 Рубин 3 Зенит 1"),
    ("Рубин 3 Зенит 1", "Рубин 3 Зенит 0 Рубин 3 Зенит 1"),
    ("Рубин 3 Зенит 1", "Рубин 3 Ахмат 1"),
    ("Тур 15", "Тур 14"),
    ("21 ноября суббота", "20 ноября пятница"),
    ("21 ноября суббота", "21 ноября суббота техническая победа"),
])
def test_matchtv_calendar_rejects_wrong_round_status_direction_or_goals(
    before, after,
):
    html = _matchtv_blob().decode()
    assert before in html
    with pytest.raises(DataError):
        parse_matchtv_result_candidate(
            html.replace(before, after).encode(), _anchor(), OBSERVED,
        )


def test_matchtv_cannot_use_old_or_hidden_scheduled_kickoff_as_final_score():
    html = _matchtv_blob().decode()
    html = html.replace("Рубин 3 Зенит 1", "Рубин Зенит 17:30")
    # A hidden script showing a fabricated played result is not evidence.
    html = html.replace(
        "</body>", "<script>Рубин 3 Зенит 1</script></body>",
    )
    with pytest.raises(DataError):
        parse_matchtv_result_candidate(html.encode(), _anchor(), OBSERVED)


@pytest.mark.parametrize("body", [
    "<html><h1>Рубин - Зенит</h1><div>Завершён 3:1</div></html>".encode(),
    b"x" * 8_000_001,
    b"\xff" * 1024,
])
def test_matchtv_calendar_rejects_invalid_or_bounded_html(body):
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
        OBSERVED.astimezone(timezone(timedelta(hours=3))),
    ):
        with pytest.raises(DataError):
            parse_openfoot_result_candidate(_openfoot_blob(), _anchor(), observed)


def test_eight_fixed_independent_ids_have_no_cross_fixture_reuse():
    assert len(MATCHTV_MATCH_IDS) == 8
    assert len(set(MATCHTV_MATCH_IDS.values())) == 8


def test_no_network_database_or_public_prediction_side_effects():
    from pathlib import Path

    path = (Path(__file__).resolve().parents[1] /
            "src/football_forecast/evaluation/m4_postmatch_sources.py")
    source = path.read_text()
    for forbidden in ("psycopg.connect", "urllib.request", "requests.get",
                      "public.ff_forecasts", "openfootapi.com/v1", "season=2025/26"):
        assert forbidden not in source


def test_independent_score_disagreement_is_denied_before_candidate_settlement():
    a = parse_openfoot_result_candidate(_openfoot_blob(), _anchor(), OBSERVED)
    b = parse_matchtv_result_candidate(
        _matchtv_blob().replace("Рубин 3 Зенит 1".encode(), "Рубин 3 Зенит 0".encode()),
        _anchor(), OBSERVED,
    )
    with pytest.raises(DataError):
        compare_provisional_played_claims(_anchor().fixture, a, b, OBSERVED)



def test_matchtv_calendar_score_stays_unverified_even_when_both_scores_agree():
    matchtv = parse_matchtv_result_candidate(_matchtv_blob(), _anchor(), OBSERVED)
    assert matchtv.status != "finished"
    assert matchtv.result_kind != "played"
    assert matchtv.home_goals == 3 and matchtv.away_goals == 1
