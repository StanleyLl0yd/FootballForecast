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
MAX_CALENDAR_BYTES = 2_000_000
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
    if type(raw) is not bytes or not 2048 <= len(raw) <= MAX_CALENDAR_BYTES:
        raise DataError("M4: independent calendar missing/oversized")
    if (not isinstance(observed_at, datetime) or observed_at.tzinfo != UTC or
            not M4_START < observed_at < FIRST_KICKOFF - timedelta(minutes=15)):
        raise DataError("M4: independent calendar was not prospectively observed")
    try:
        text = VisibleText()
        text.feed(raw.decode("utf-8", errors="strict"))
        visible = re.sub(r"\s+", " ", " ".join(text.fragments))
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4: calendar invalid HTML/UTF8") from exc
    # A literal static fixture list or a predeclared digest is insufficient:
    # all eight pairs must occur in this newly fetched *visible* response.
    for slot, (home, away) in DIRECTED.items():
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
        times = {(match.group("date"), match.group("time"))
                 for match in pattern.finditer(visible)}
        if times != {expected}:
            raise DataError("M4: live publisher pair/time/status diverged")
    return sha256(raw).hexdigest()
