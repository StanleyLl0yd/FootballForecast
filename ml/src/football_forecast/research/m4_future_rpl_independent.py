"""Fail-closed LIVE independent schedule corroboration, not as-of approval.

A current, bounded publisher HTML response is compared against the *separate*
authenticated fixture feed. Pinned pair/time values are sanity constraints,
NEVER evidence that the page was fetched or timestamped. No scraping of scores,
history, odds, match identifiers, or 2025/26. No DB access or publication.
"""
import re
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from html.parser import HTMLParser

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_identity import DIRECTED
from football_forecast.research.m4_future_rpl_source import FIRST_KICKOFF, M4_START

CALENDAR_URL = "https://www.championat.com/football/_russiapl/tournament/7096/calendar/"
MAX_CALENDAR_BYTES = 8_000_000
# Publisher's *visible* Moscow-time fixture names (not OpenFoot team IDs).
PUBLIC_NAMES = {
    "rostov": r"Ростов",
    "krylya": r"Крылья\s+Советов",
    "orenburg": r"Оренбург",
    "baltika": r"Балтика",
    "akron": r"Акрон",
    "fakel": r"Факел",
    "rubin": r"Рубин",
    "zenit": r"Зенит",
    "cska": r"ЦСКА",
    "akhmat": r"Ахмат",
    "dynamo_moscow": r"Динамо(?:\s+М)?",
    "krasnodar": r"Краснодар",
    "dynamo_makhachkala": r"Динамо\s+Мх",
    "spartak": r"Спартак(?:\s+М)?",
    "rodina": r"Родина",
    "lokomotiv": r"Локомотив(?:\s+М)?",
}
assert set(PUBLIC_NAMES) == {slug for pair in DIRECTED.values() for slug in pair}


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fragments = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template", "noscript"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "template", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, value):
        if not self.skip and value.strip():
            self.fragments.append(value)


def verify_live_independent_calendar(raw: bytes, observed_at: datetime) -> str:
    """Require exactly the pinned directed *scheduled* public fixtures live.

    Return a source-byte SHA-256 only. An HTML page with one missing, revised,
    duplicate or wrong-direction fixture refuses the ENTIRE batch.
    """
    if type(raw) is not bytes or len(raw) < 512:
        raise DataError("M4_CALENDAR_BOUND_SMALL")
    if len(raw) > MAX_CALENDAR_BYTES:
        raise DataError("M4_CALENDAR_BOUND_LARGE")
    if (not isinstance(observed_at, datetime) or observed_at.tzinfo != UTC or
            not M4_START < observed_at < FIRST_KICKOFF - timedelta(minutes=15)):
        raise DataError("M4_CALENDAR_CLOCK")
    try:
        text = VisibleText()
        text.feed(raw.decode("utf-8", errors="strict"))
        visible = re.sub(r"\s+", " ", " ".join(text.fragments))
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4_CALENDAR_UTF8") from exc
    # A literal static fixture list or a predeclared digest is insufficient:
    # all eight pairs must occur in this newly fetched *visible* response.
    for slot_number, (slot, (home, away)) in enumerate(DIRECTED.items(), start=1):
        dt = datetime.fromisoformat(slot.replace("Z", "+00:00"))
        msk = dt + timedelta(hours=3)
        expected = (msk.strftime("%d.%m.%Y"), msk.strftime("%H:%M"))
        # Championat calendar lists: DD.MM.YYYY HH:MM [Тур 15 DD.MM.YYYY HH:MM]
        # HOME – AWAY – : –. Require an unplayed scoreboard.
        pattern = re.compile(
            r"(?P<date>\d{2}\.\d{2}\.2026)\s+(?P<time>\d{2}:\d{2})"
            r"(?:\s+Тур\s+15\s+\d{2}\.\d{2}\.2026\s+\d{2}:\d{2})?"
            r"\s+" + PUBLIC_NAMES[home] + r"\s*[–—-]\s*" +
            PUBLIC_NAMES[away] + r"\s*[–—-]\s*:\s*[–—-]",
            re.IGNORECASE,
        )
        matches = list(pattern.finditer(visible))
        if len(matches) != 1 or (
            matches[0].group("date"), matches[0].group("time")
        ) != expected:
            # Public-safe diagnostics: only slot index, bounded hit count and
            # presence flags. No body, URL fragments, names, IDs, or snippets.
            markers = "".join(str(int(bool(found))) for found in (
                expected[0] in visible, expected[1] in visible,
                re.search(PUBLIC_NAMES[home], visible) is not None,
                re.search(PUBLIC_NAMES[away], visible) is not None,
            ))
            raise DataError(
                f"M4_CALENDAR_SLOT_{slot_number}_REJECT_COUNT_"
                f"{min(len(matches), 9)}_MARKERS_{markers}"
            )
    return sha256(raw).hexdigest()


# Alternative independent editorial source: full RPL calendar at MatchTV.
# It must be fetched LIVE after the provider's response, never substituted
# with the old fixed calendar or an archival article.
MATCHTV_URL = "https://matchtv.ru/football/rpl/calendar/2026-27"
MATCHTV_NAMES = {
    "rostov": "Ростов", "krylya": "Крылья Советов",
    "orenburg": "Оренбург", "baltika": "Балтика",
    "akron": "Акрон", "fakel": "Факел",
    "rubin": "Рубин", "zenit": "Зенит",
    "cska": "ЦСКА", "akhmat": "Ахмат",
    "dynamo_moscow": "Динамо М", "krasnodar": "Краснодар",
    "dynamo_makhachkala": "Динамо Мх", "spartak": "Спартак",
    "rodina": "Родина", "lokomotiv": "Локомотив",
}
assert set(MATCHTV_NAMES) == set(PUBLIC_NAMES)
MATCHTV_DAYS = (
    ("20 ноября пятница", "2026-11-20"),
    ("21 ноября суббота", "2026-11-21"),
    ("22 ноября воскресенье", "2026-11-22"),
)


def verify_live_matchtv_calendar(raw: bytes, observed_at: datetime) -> str:
    """Require every directed match with exact Moscow local time in LIVE round 15.

    No results, historical scores, odds, news, or bookmaker data are parsed.
    Absence, duplicate fixtures, TBA instead of time, revised kickoff,
    awarded/played displays, and unknown pairs fail closed.
    """
    if type(raw) is not bytes or len(raw) < 512:
        raise DataError("M4_MATCHTV_BOUND_SMALL")
    if len(raw) > MAX_CALENDAR_BYTES:
        raise DataError("M4_MATCHTV_BOUND_LARGE")
    if (not isinstance(observed_at, datetime) or observed_at.tzinfo != UTC or
            not M4_START < observed_at < FIRST_KICKOFF - timedelta(minutes=15)):
        raise DataError("M4_MATCHTV_CLOCK")
    parser = VisibleText()
    try:
        parser.feed(raw.decode("utf-8", errors="strict"))
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4_MATCHTV_UTF8") from exc
    visible = re.sub(r"\\s+", " ", " ".join(parser.fragments))
    section = re.search(r"\\bТур\\s+15\\b(.*?)\\bТур\\s+16\\b", visible,
                        re.IGNORECASE)
    if section is None or len(re.findall(
        r"\\bТур\\s+15\\b", visible, re.IGNORECASE
    )) != 1:
        raise DataError("M4_MATCHTV_ROUND")
    round_text = section.group(1)
    markers = [day[0] for day in MATCHTV_DAYS]
    if any(round_text.count(marker) != 1 for marker in markers):
        raise DataError("M4_MATCHTV_DAYS")
    day_segments = {}
    starts = [round_text.index(marker) for marker in markers]
    if starts != sorted(starts):
        raise DataError("M4_MATCHTV_DAY_ORDER")
    for index, (_, day) in enumerate(MATCHTV_DAYS):
        day_segments[day] = round_text[
            starts[index] + len(markers[index]):
            starts[index + 1] if index + 1 < len(starts) else len(round_text)
        ]
    for slot_index, (slot, (home, away)) in enumerate(DIRECTED.items(), start=1):
        local = datetime.fromisoformat(slot.replace("Z", "+00:00")) + timedelta(hours=3)
        day_text = day_segments.get(local.strftime("%Y-%m-%d"), "")
        pattern = re.compile(
            r"(?<!\\w)" + re.escape(MATCHTV_NAMES[home]) + r"\\s+" +
            re.escape(MATCHTV_NAMES[away]) + r"\\s+" +
            re.escape(local.strftime("%H:%M")) + r"(?!\\d)",
            re.IGNORECASE,
        )
        if len(pattern.findall(day_text)) != 1:
            raise DataError(f"M4_MATCHTV_SLOT_{slot_index}_UNVERIFIED")
    return sha256(raw).hexdigest()
