"""Synthetic-only MatchTV independent live calendar admission tests."""
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_identity import DIRECTED
from football_forecast.research.m4_future_rpl_independent import (
    MATCHTV_NAMES,
    verify_live_matchtv_calendar,
)

OBSERVED = datetime(2026, 11, 14, 9, 59, tzinfo=UTC)
DAY_LABELS = {
    "2026-11-20": "20 ноября пятница",
    "2026-11-21": "21 ноября суббота",
    "2026-11-22": "22 ноября воскресенье",
}


def matchtv_fixture():
    rows = ["<h3>Тур 15</h3>"]
    for day, header in DAY_LABELS.items():
        rows.append("<h4>" + header + "</h4>")
        for utc, (home, away) in DIRECTED.items():
            dt = datetime.fromisoformat(utc.replace("Z", "+00:00"))
            if dt.strftime("%Y-%m-%d") != day:
                continue
            msk = dt + timedelta(hours=3)
            rows.append(
                "<div>" + MATCHTV_NAMES[home] + " " +
                MATCHTV_NAMES[away] + " " +
                msk.strftime("%H:%M") + "</div>"
            )
    return ("<html><body>" + "".join(rows) + "<h3>Тур 16</h3>" +
            "X" * 2048 + "</body></html>").encode()


def test_valid_live_round_and_exact_utc_to_moscow():
    assert len(verify_live_matchtv_calendar(matchtv_fixture(), OBSERVED)) == 64


@pytest.mark.parametrize(("before", "after"), [
    ("Ростов Крылья Советов 19:30", "Ростов Крылья Советов TBA"),
    ("Оренбург Балтика 13:00", "Балтика Оренбург 13:00"),
    ("Рубин Зенит 17:30", "Рубин Зенит 17:31"),
    ("Динамо М Краснодар 14:00", "Динамо Мх Краснодар 14:00"),
    ("Акрон Факел 15:15", "Акрон 2 Факел 1 15:15"),
    ("20 ноября пятница", "21 ноября суббота"),
    ("Тур 15", "Тур 14"),
])
def test_changed_time_home_away_status_or_round_refuses(before, after):
    page = matchtv_fixture().decode()
    assert before in page
    with pytest.raises(DataError):
        verify_live_matchtv_calendar(page.replace(before, after).encode(), OBSERVED)


def test_duplicate_slot_refused():
    page = matchtv_fixture().decode()
    exact = "<div>Рубин Зенит 17:30</div>"
    with pytest.raises(DataError, match="M4_MATCHTV_SLOT_4_UNVERIFIED"):
        verify_live_matchtv_calendar(page.replace(exact, exact + exact).encode(), OBSERVED)


def test_script_only_fixtures_are_not_visible():
    page = matchtv_fixture().decode()
    selected = page[page.index("<h3>Тур 15</h3>"):page.index("<h3>Тур 16</h3>")]
    hidden = ("<html><script>" + selected + "</script><body>" +
              "<h3>Тур 15</h3> " + "X" * 2048 +
              "<h3>Тур 16</h3></body></html>").encode()
    with pytest.raises(DataError):
        verify_live_matchtv_calendar(hidden, OBSERVED)


def test_old_new_or_naive_observation_time_rejected():
    for when in (
        datetime(2026, 11, 11, 11, 4, 56, tzinfo=UTC),
        datetime(2026, 11, 20, 16, 15, tzinfo=UTC),
        datetime(2026, 11, 14, 9, 59),
    ):
        with pytest.raises(DataError, match="M4_MATCHTV_CLOCK"):
            verify_live_matchtv_calendar(matchtv_fixture(), when)


def test_bad_body_refusal():
    with pytest.raises(DataError, match="M4_MATCHTV_BOUND_SMALL"):
        verify_live_matchtv_calendar(b"no current calendar", OBSERVED)
