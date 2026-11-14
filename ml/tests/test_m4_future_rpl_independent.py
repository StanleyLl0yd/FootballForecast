"""Synthetic-only regression for live independent schedule parsing (no network)."""
import re
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_identity import DIRECTED
from football_forecast.research.m4_future_rpl_independent import (
    MAX_CALENDAR_BYTES,
    PUBLIC_NAMES,
    verify_live_independent_calendar,
)

AT = datetime(2026, 11, 12, 14, 35, tzinfo=UTC)
NAMES = {
    "rostov": "Ростов", "krylya": "Крылья Советов",
    "orenburg": "Оренбург", "baltika": "Балтика",
    "akron": "Акрон", "fakel": "Факел",
    "rubin": "Рубин", "zenit": "Зенит",
    "cska": "ЦСКА", "akhmat": "Ахмат",
    "dynamo_moscow": "Динамо М", "krasnodar": "Краснодар",
    "dynamo_makhachkala": "Динамо Мх", "spartak": "Спартак М",
    "rodina": "Родина", "lokomotiv": "Локомотив М",
}


def html_rows():
    fixtures = []
    for utc, (home, away) in DIRECTED.items():
        msk = datetime.fromisoformat(utc.replace("Z", "+00:00")) + timedelta(hours=3)
        day, clock = msk.strftime("%d.%m.%Y"), msk.strftime("%H:%M")
        fixtures.append(
            f"<p>15 {day} {clock} Тур 15 {day} {clock} "
            f"{NAMES[home]} – {NAMES[away]} – : –</p>"
        )
    return ("<html><body>" + "".join(fixtures) + "X" * 2100 +
            "</body></html>").encode("utf-8")


def test_visible_live_eight_matches_only():
    assert set(NAMES) == set(PUBLIC_NAMES)
    digest = verify_live_independent_calendar(html_rows(), AT)
    assert len(digest) == 64


@pytest.mark.parametrize("old,new", [
    ("17:30", "17:31"),
    ("Рубин – Зенит", "Зенит – Рубин"),
    ("Динамо Мх – Спартак М", "Динамо М – Спартак М"),
    ("Акрон – Факел – : –", "Акрон – Факел 2 : 0"),
    ("Ростов – Крылья Советов", "Ростов – неизвестная команда"),
])
def test_refuse_schedule_revisions_or_unknowns(old, new):
    assert old in html_rows().decode()
    with pytest.raises(DataError):
        verify_live_independent_calendar(
            html_rows().decode().replace(old, new).encode(), AT,
        )


def test_duplicate_live_fixture_is_not_an_independent_calendar():
    raw = html_rows().decode()
    first = raw[raw.index("<p>"):raw.index("</p>") + 4]
    with pytest.raises(DataError):
        verify_live_independent_calendar(raw.replace("</body>", first + "</body>").encode(), AT)


def test_rejection_is_redacted_public_slot_metadata_only():
    page = html_rows().decode().replace("Рубин – Зенит", "Рубин – неверно")
    with pytest.raises(DataError) as error:
        verify_live_independent_calendar(page.encode(), AT)
    assert re.fullmatch(
        r"M4_CALENDAR_SLOT_[1-8]_REJECT_COUNT_[0-9]_MARKERS_[01]{4}",
        str(error.value),
    )
    assert "Зенит" not in str(error.value)


def test_hidden_script_is_not_a_schedule():
    raw = html_rows().decode()
    rows = raw[raw.index("<p>"):raw.index("X" * 20)]
    html = ("<html><body><script>" + rows + "</script>" +
            " X" * 2500 + "</body></html>").encode()
    with pytest.raises(DataError):
        verify_live_independent_calendar(html, AT)


def test_wrong_or_forged_observation_window():
    for when in (
        datetime(2026, 11, 11, 11, 4, 56, tzinfo=UTC),
        datetime(2026, 11, 20, 16, 15, tzinfo=UTC),
        datetime(2026, 11, 21, 0, 0, tzinfo=UTC),
        datetime(2026, 11, 12, 12, 0),
    ):
        with pytest.raises(DataError):
            verify_live_independent_calendar(html_rows(), when)


def test_large_but_bounded_public_calendar_still_requires_real_pairs():
    raw = html_rows().replace(b"X" * 2100, b"X" * 2_200_000)
    assert len(raw) > 2_000_000
    assert len(verify_live_independent_calendar(raw, AT)) == 64


def test_bound_and_malformed_unicode():
    for raw in (b"", b"x" * (MAX_CALENDAR_BYTES + 1),
                b"\xff" * 2048):
        with pytest.raises(DataError):
            verify_live_independent_calendar(raw, AT)
