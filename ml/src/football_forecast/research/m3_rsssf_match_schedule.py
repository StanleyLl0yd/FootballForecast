"""Bounded RSSSF RPL 2021/22 and 2022/23 retrospective fixture parser.

Consumes exactly two season-specific public pages, not a multi-year feed.
No network, database, filesystem, private IDs, model or holdout access here.
Output is an in-memory public reference; public workflows print aggregates only.
"""
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from html.parser import HTMLParser
from json import dumps

from football_forecast.data.contracts import DataError

SEASONS = {
    "2021/22": {
        "anchor": "TINKOFF RUSSIAN PREMIER LEAGUE 2021/22",
        "goals": (359, 280),
        "teams": frozenset((
            "Ahmat", "Arsenal", "CSKA", "Dinamo", "Khimki", "Krasnodar",
            "KS Samara", "Lokomotiv", "NNovgorod", "Rostov", "Rubin", "Sochi",
            "Spartak", "Ufa", "Ural", "Zenit",
        )),
    },
    "2022/23": {
        "anchor": "MIR RUSSIAN PREMIER LEAGUE 2022/23",
        "goals": (411, 319),
        "teams": frozenset((
            "Akhmat", "CSKA", "Dinamo", "Fakel", "Khimki", "Krasnodar",
            "KS Samara", "Lokomotiv", "Orenburg", "Pari NN", "Rostov", "Sochi",
            "Spartak", "Torpedo", "Ural", "Zenit",
        )),
    },
}
MONTHS = dict(zip(
    "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), range(1, 13),
    strict=True,
))
ROUND = re.compile(r"^\s*Round\s+(\d{1,2})(?:\s+\[([^\]]+)\])?\s*$")
DAY = re.compile(r"\[(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?=[^\d]|$)")
SCORE = re.compile(
    r"^\s*([A-Za-z][A-Za-z ]{1,20}?)\s+(\d{1,2})-(\d{1,2})"
    r"\s+([A-Za-z][A-Za-z ]{1,20}?)\s*$"
)


def _invalid(reason: str) -> None:
    raise DataError("M3 RSSSF two-season reference: " + reason)


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.segments: list[str] = []
        self.suppressed = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("style", "script"):
            self.suppressed += 1
        if tag in ("br", "p", "div", "pre"):
            self.segments.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script"):
            self.suppressed = max(0, self.suppressed - 1)
        if tag in ("p", "div", "pre"):
            self.segments.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.suppressed:
            self.segments.append(data)


@dataclass(frozen=True, slots=True)
class PublicFixture:
    season: str
    round: int
    day: date
    home: str
    away: str
    home_goals: int
    away_goals: int
    official_result_revised: bool = False


@dataclass(frozen=True, slots=True)
class PublicSourceAudit:
    season: str
    source_sha256: str
    fixture_graph_sha256: str
    scoreline_histogram_sha256: str
    scoreline_histogram: tuple[tuple[int, int, int], ...]
    fixtures: int
    clubs: int
    directed_pairs: int
    rounds: int
    home_goals: int
    away_goals: int
    revised_official_scores: int
    classification: str = "RETROSPECTIVE_PUBLIC_REFERENCE_NOT_ORIGINAL_AS_OF"


def parse_rsssf_rpl(source: bytes, season: str) -> tuple[PublicFixture, ...]:
    """Reject incomplete/ambiguous pages; never silently pad missing fixtures."""
    if season not in SEASONS or type(source) is not bytes or not 100 <= len(source) <= 3_000_000:
        _invalid("untrusted season or source envelope")
    # RSSSF's historical pages contain legacy Latin-1 bytes. Decode without
    # replacement, then rely on all 240 fixtures / identities / goals gates.
    # This is a deterministic compatibility fallback, not permissive scraping.
    try:
        decoded = source.decode("utf-8")
    except UnicodeDecodeError:
        decoded = source.decode("latin-1")
    html = _Text()
    html.feed(decoded)
    lines = "".join(html.segments).splitlines()
    anchor = SEASONS[season]["anchor"]
    location = next((i for i, line in enumerate(lines) if anchor in line), None)
    if location is None:
        _invalid("missing exact competition and season heading")
    start = next(
        (i for i in range(location + 1, len(lines)) if ROUND.fullmatch(lines[i])
         and ROUND.fullmatch(lines[i]).group(1) == "1"),
        None,
    )
    if start is None or start - location > 150:
        _invalid("missing first top-flight league round")
    years = int(season[:4])
    fixtures: list[PublicFixture] = []
    round_counts: Counter[int] = Counter()
    round_number = 0
    current_day: date | None = None
    for line in lines[start:]:
        heading = ROUND.fullmatch(line)
        if heading:
            next_round = int(heading.group(1))
            if next_round != round_number + 1 or next_round > 30:
                _invalid("non-contiguous or unexpected top-flight round")
            if round_number and round_counts[round_number] != 8:
                _invalid("previous round must contain eight results")
            round_number = next_round
            current_day = None
        date_match = DAY.search(line) if line.strip().startswith("[") or heading else None
        if date_match:
            month,day = MONTHS[date_match.group(1)],int(date_match.group(2))
            try:
                current_day = date(years if month >= 7 else years + 1, month, day)
            except ValueError:
                _invalid("invalid reference date")
        score = SCORE.fullmatch(line)
        if score and round_number:
            home,hg,ag,away = score.groups()
            if home not in SEASONS[season]["teams"] or away not in SEASONS[season]["teams"]:
                _invalid("unexpected league club alias")
            if current_day is None:
                _invalid("match lacks retrospective date")
            if round_number == 1 and (current_day.year != years or current_day.month != 7):
                _invalid("first round must be in July of season start year")
            if round_number == 30 and (current_day.year != years + 1
                                       or current_day.month not in (5, 6)):
                _invalid("last round must be in May or June of final year")
            gh,ga = int(hg),int(ag)
            if home == away or gh > 20 or ga > 20:
                _invalid("impossible fixture identity or score")
            revised = (season == "2022/23" and current_day == date(2023, 3, 19)
                       and home == "Pari NN" and away == "Torpedo")
            if revised and (gh,ga) != (0,3):
                _invalid("officially revised result changed")
            fixtures.append(PublicFixture(season,round_number,current_day,home,away,
                                          gh,ga,revised))
            round_counts[round_number] += 1
            if round_counts[round_number] > 8:
                _invalid("round exceeds eight fixtures")
            if len(fixtures) == 240:
                break
    if len(fixtures) != 240 or round_number != 30 or len(round_counts) != 30:
        _invalid("incomplete RPL season")
    if any(round_counts[i] != 8 for i in range(1,31)):
        _invalid("round with missing fixtures")
    clubs = {item.home for item in fixtures} | {item.away for item in fixtures}
    pairs = {(item.home,item.away) for item in fixtures}
    if clubs != SEASONS[season]["teams"] or len(pairs) != 240:
        _invalid("club roster or directed fixture integrity failure")
    hgoals=sum(x.home_goals for x in fixtures)
    agoals=sum(x.away_goals for x in fixtures)
    if (hgoals,agoals) != SEASONS[season]["goals"]:
        _invalid("independent published goal totals disagree")
    revised=[x for x in fixtures if x.official_result_revised]
    if len(revised) != int(season=="2022/23"):
        _invalid("known later-official-score revision not isolated")
    return tuple(fixtures)


def audit_rsssf_rpl(source: bytes, season: str) -> PublicSourceAudit:
    fixtures=parse_rsssf_rpl(source,season)
    graph = [
        (x.season,x.round,x.day.isoformat(),x.home,x.away,
         x.home_goals,x.away_goals,x.official_result_revised)
        for x in sorted(fixtures,key=lambda x:(x.day,x.round,x.home,x.away))
    ]
    histogram=sorted(Counter((x.home_goals,x.away_goals) for x in fixtures).items())
    bins=tuple((h,a,n) for (h,a),n in histogram)
    def checksum(value: object) -> str:
        return sha256(dumps(value,ensure_ascii=True,separators=(",",":")).encode()).hexdigest()
    return PublicSourceAudit(
        season=season,
        source_sha256=sha256(source).hexdigest(),
        fixture_graph_sha256=checksum(graph),
        scoreline_histogram_sha256=checksum(histogram),
        scoreline_histogram=bins,
        fixtures=240,clubs=16,directed_pairs=240,rounds=30,
        home_goals=sum(x.home_goals for x in fixtures),
        away_goals=sum(x.away_goals for x in fixtures),
        revised_official_scores=sum(x.official_result_revised for x in fixtures),
    )
