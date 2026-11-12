"""Strict directed identity corroboration for future 2026/27 RPL round 15.

The eight canonical pairs and UTC slots were predeclared from independently
published Championat and Sport-Express schedules (observed 12 Nov 2026).
A provider name match is NOT independent proof of the provider's club ID,
original serving time, receipt signature, or permission to write forecasts.
Unknown names fail closed. No I/O, model, database, public API or 2025/26 reads.
"""
import re
import unicodedata

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_source import _json, _utc

# Independent fixture names and Moscow-to-UTC times, fixed before live capture:
# https://www.championat.com/football/_russiapl/tournament/7096/calendar/
# https://www.sport-express.ru/football/rfpl/stories/rpl-15-y-tur-raspisanie-rezultaty-novosti-obzory-matchi-20-22-noyabrya-chempionat-rossii-2026-27-2459710/
DIRECTED = {
    "2026-11-20T16:30:00Z": ("rostov", "krylya"),
    "2026-11-21T10:00:00Z": ("orenburg", "baltika"),
    "2026-11-21T12:15:00Z": ("akron", "fakel"),
    "2026-11-21T14:30:00Z": ("rubin", "zenit"),
    "2026-11-21T16:45:00Z": ("cska", "akhmat"),
    "2026-11-22T11:00:00Z": ("dynamo_moscow", "krasnodar"),
    "2026-11-22T13:30:00Z": ("dynamo_makhachkala", "spartak"),
    "2026-11-22T16:00:00Z": ("rodina", "lokomotiv"),
}

# Explicit, reviewable aliases only. No fuzzy names or guessing city identity.
_NAMES = {
    "rostov": ("ростов", "rostov", "rostov on don"),
    "krylya": ("крылья советов", "крылья советов самара",
               "krylya sovetov", "krylya sovetov samara",
               "krylia sovetov", "krylia sovetov samara"),
    "orenburg": ("оренбург", "orenburg"),
    "baltika": ("балтика", "балтика калининград", "baltika",
                "baltika kaliningrad"),
    "akron": ("акрон", "акрон тольятти", "akron", "akron togliatti"),
    "fakel": ("факел", "факел воронеж", "fakel", "fakel voronezh"),
    "rubin": ("рубин", "рубин казань", "rubin", "rubin kazan"),
    "zenit": ("зенит", "зенит санкт петербург", "zenit",
              "zenit st petersburg", "zenit saint petersburg",
              "zenit spb", "zenit petersburg"),
    "cska": ("цска", "цска москва", "cska", "cska moscow",
             "cska moskva"),
    "akhmat": ("ахмат", "ахмат грозный", "akhmat", "akhmat grozny"),
    "dynamo_moscow": ("динамо", "динамо москва", "dynamo",
                      "dynamo moscow", "dinamo moscow", "dinamo moskva",
                      "dynamo moskva"),
    "krasnodar": ("краснодар", "krasnodar"),
    "dynamo_makhachkala": ("динамо мх", "динамо махачкала",
                           "dynamo makhachkala", "dinamo makhachkala",
                           "dynamo makh", "dinamo makh"),
    "spartak": ("спартак", "спартак москва", "spartak",
                "spartak moscow", "spartak moskva"),
    "rodina": ("родина", "родина москва", "rodina", "rodina moscow"),
    "lokomotiv": ("локомотив", "локомотив москва", "lokomotiv",
                  "lokomotiv moscow", "lokomotiv moskva"),
}
_NAME_LOOKUP = {
    name: club
    for club, variants in _NAMES.items()
    for name in variants
}
assert len(_NAME_LOOKUP) == sum(len(x) for x in _NAMES.values())


def _deny():
    raise DataError("M4: independently pinned directed future clubs not corroborated")


def _club(name):
    if (type(name) is not str or not 2 <= len(name) <= 120
            or any(unicodedata.category(ch).startswith("C") for ch in name)):
        _deny()
    value = unicodedata.normalize("NFKC", name).casefold().replace("ё", "е")
    value = re.sub(r"[^\w]+", " ", value, flags=re.UNICODE).strip()
    parts = value.split()
    if parts and parts[0] in {"fc", "fk", "фк"}:
        parts.pop(0)
    if parts and parts[-1] in {"fc", "fk", "фк"}:
        parts.pop()
    canonical = _NAME_LOOKUP.get(" ".join(parts))
    if canonical is None:
        _deny()
    return canonical


def verify_directed_future_identities(days: dict[str, bytes]) -> None:
    """Fail closed on swapped, wrong, repeated, or ambiguous source club IDs."""
    if type(days) is not dict or set(days) != {
        "2026-11-20", "2026-11-21", "2026-11-22"
    }:
        _deny()
    seen_slots: set[str] = set()
    slug_to_id: dict[str, str] = {}
    id_to_slug: dict[str, str] = {}
    for day in sorted(days):
        doc = _json(days[day])
        if type(doc) is not dict or type(doc.get("data")) is not list:
            _deny()
        for match in doc["data"]:
            if type(match) is not dict or type(match.get("kickoffAt")) is not str:
                _deny()
            slot = _utc(match["kickoffAt"]).strftime("%Y-%m-%dT%H:%M:%SZ")
            if slot in seen_slots or slot not in DIRECTED or not slot.startswith(day):
                _deny()
            seen_slots.add(slot)
            home = match.get("homeTeam")
            away = match.get("awayTeam")
            if type(home) is not dict or type(away) is not dict:
                _deny()
            a, b = _club(home.get("name")), _club(away.get("name"))
            if (a, b) != DIRECTED[slot]:
                _deny()
            for slug, team in ((a, home), (b, away)):
                key = team.get("id")
                if (type(key) is not str or not 2 <= len(key) <= 160
                        or (slug in slug_to_id and slug_to_id[slug] != key)
                        or (key in id_to_slug and id_to_slug[key] != slug)):
                    _deny()
                slug_to_id[slug] = key
                id_to_slug[key] = slug
    if seen_slots != set(DIRECTED) or len(slug_to_id) != 16:
        _deny()
