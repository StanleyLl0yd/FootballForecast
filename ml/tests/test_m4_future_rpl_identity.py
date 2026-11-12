"""Synthetic adversarial tests of private 15th-round directed club identities."""
from copy import deepcopy
from datetime import UTC, datetime
from json import dumps

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_identity import (
    DIRECTED,
    verify_directed_future_identities,
)
from football_forecast.research.m4_future_rpl_source import (
    COMPETITION,
    inspect_future_rpl_source,
)

_RU = {
    "rostov": "Ростов", "krylya": "Крылья Советов",
    "orenburg": "Оренбург", "baltika": "Балтика",
    "akron": "Акрон", "fakel": "Факел",
    "rubin": "Рубин", "zenit": "Зенит",
    "cska": "ЦСКА", "akhmat": "Ахмат",
    "dynamo_moscow": "Динамо Москва", "krasnodar": "Краснодар",
    "dynamo_makhachkala": "Динамо Махачкала", "spartak": "Спартак",
    "rodina": "Родина", "lokomotiv": "Локомотив",
}


def _rows():
    out = {"2026-11-20": [], "2026-11-21": [], "2026-11-22": []}
    for i, (slot, (home, away)) in enumerate(DIRECTED.items()):
        out[slot[:10]].append({
            "id": f"synthetic_match_{i+1}", "competitionId": COMPETITION,
            "season": "2026/27", "status": "scheduled",
            "kickoffAt": slot.replace("Z", ".000Z"), "score": None,
            "homeTeam": {"name": _RU[home], "id": f"synthetic_{home}"},
            "awayTeam": {"name": _RU[away], "id": f"synthetic_{away}"},
        })
    return out


def _encode(rows):
    return {
        day: dumps({"data": matches, "meta": {
            "count": len(matches), "access": {"authenticated": True}
        }}).encode() for day, matches in rows.items()
    }


def test_independently_pinned_directions_pass_with_realistic_names_only():
    days = _encode(_rows())
    assert verify_directed_future_identities(days) is None
    assert inspect_future_rpl_source(
        days, datetime(2026, 11, 12, 15, tzinfo=UTC)
    ).fixtures == 8


@pytest.mark.parametrize("change", ["swap", "wrong_pair", "unknown_name",
                                     "ambiguous_city", "duplicate_club_id",
                                     "wrong_source_time", "spoofed_name"])
def test_wrong_named_directed_corroboration_refused(change):
    docs = _rows()
    row = docs["2026-11-21"][2]
    if change == "swap":
        row["homeTeam"], row["awayTeam"] = row["awayTeam"], row["homeTeam"]
    elif change == "wrong_pair":
        row["awayTeam"]["name"] = "Краснодар"
    elif change == "unknown_name":
        row["homeTeam"]["name"] = "Unknown FC"
    elif change == "ambiguous_city":
        docs["2026-11-22"][1]["homeTeam"]["name"] = "Динамо Москва"
    elif change == "duplicate_club_id":
        row["awayTeam"]["id"] = row["homeTeam"]["id"]
    elif change == "wrong_source_time":
        row["kickoffAt"] = "2026-11-21T14:45:00.000Z"
    elif change == "spoofed_name":
        row["homeTeam"]["name"] = "Рубин\u200b"
    with pytest.raises(DataError):
        verify_directed_future_identities(_encode(docs))


def test_unknown_aliases_not_accepted_just_for_having_16_opaque_ids():
    rows = deepcopy(_rows())
    for matches in rows.values():
        for row in matches:
            row["homeTeam"]["name"] = "Generic Team"
    data = _encode(rows)
    assert inspect_future_rpl_source(
        data, datetime(2026, 11, 12, 15, tzinfo=UTC)
    ).fixtures == 8
    with pytest.raises(DataError):
        verify_directed_future_identities(data)


def test_no_private_identifiers_or_unreviewed_io_in_module():
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "src" / (
        "football_forecast/research/m4_future_rpl_identity.py"
    )
    source = path.read_text(encoding="utf-8")
    for forbidden in ("psycopg.connect", "requests.get", "urllib.request",
                      "public.ff_forecasts", "2025/26'", "print("):
        assert forbidden not in source
    script = Path(__file__).resolve().parents[2] / "scripts" / (
        "m4-owner-future-source-observe.py"
    )
    text = script.read_text(encoding="utf-8")
    assert "verify_directed_future_identities(data)" in text
