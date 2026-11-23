"""M4-A6 STRICT private post-match source-claim parsers; NO truth attestation.

These are source-specific shape/identity/played *claims* only. Provider data,
HTTP body, and MatchTV text are all untrusted until an independent protected
worker proves current HTTPS retrieval, authentic OIDC byte time and source
independence. A site's "finished" display can still conceal technical awards.
Never score, write a DB result, approve a model or publish on this evidence.
Only prospective RPL 2026/27 round 15. Never inspect the 2025/26 holdout.
"""
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from html.parser import HTMLParser

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED, _club
from football_forecast.research.m4_future_rpl_source import (
    COMPETITION,
    SEASON,
    _json,
    _utc,
)

MAX_MATCHTV_BYTES = 8_000_000
MIN_RESULT_AGE = timedelta(minutes=90)
# MatchTV fixture ID crosswalk identified in precommitted round-15 calendar;
# URLs are NEVER taken from provider JSON, JWT headers or caller-supplied links.
MATCHTV_MATCH_IDS = {
    "rpl-2026-27-r15-20261120-1630": "552665053",  # Rostov - Krylya
    "rpl-2026-27-r15-20261121-1000": "552665050",  # Orenburg - Baltika
    "rpl-2026-27-r15-20261121-1215": "552665048",  # Akron - Fakel
    "rpl-2026-27-r15-20261121-1430": "552665047",  # Rubin - Zenit
    "rpl-2026-27-r15-20261121-1645": "552665054",  # CSKA - Akhmat
    "rpl-2026-27-r15-20261122-1100": "552665051",  # Dinamo M - Krasnodar
    "rpl-2026-27-r15-20261122-1330": "552665052",  # Dinamo Mkh - Spartak
    "rpl-2026-27-r15-20261122-1600": "552665049",  # Rodina - Lokomotiv
}
# Date in MatchTV URL path can reflect initially scheduled editorial date,
# not actual observed kickoff. The page's visible date/time MUST match A5.
MATCHTV_PATHS = {
    "552665047": "/football/rpl/552665047-rubin-zenit-21-11-2026",
    "552665048": "/football/rpl/552665048-akron-fakel-21-11-2026",
    "552665049": "/football/rpl/552665049-rodina-lokomotiv-21-11-2026",
    "552665050": "/football/rpl/552665050-orenburg-baltika-21-11-2026",
    "552665051": "/football/rpl/552665051-dinamo-krasnodar-21-11-2026",
    "552665052": "/football/rpl/552665052-dinamo-spartak-21-11-2026",
    "552665053": "/football/rpl/552665053-rostov-kryliasovetov-21-11-2026",
    "552665054": "/football/rpl/552665054-tsska-akhmat-21-11-2026",
}
assert len(set(MATCHTV_MATCH_IDS.values())) == len(DIRECTED) == len(MATCHTV_PATHS)


@dataclass(frozen=True, slots=True)
class A5PostmatchAnchor:
    fixture: FrozenFixtureIdentity
    home_provider_id: str
    away_provider_id: str


def _deny() -> None:
    raise DataError("M4-A6: unverified post-match source/identity/played claim")


def _verify_anchor(anchor: A5PostmatchAnchor, observed_at: datetime):
    if (type(anchor) is not A5PostmatchAnchor
            or type(anchor.fixture) is not FrozenFixtureIdentity
            or type(observed_at) is not datetime
            or observed_at.tzinfo != UTC
            or type(anchor.home_provider_id) is not str
            or type(anchor.away_provider_id) is not str
            or not re.fullmatch(r"[A-Za-z0-9_.:-]{2,160}", anchor.home_provider_id)
            or not re.fullmatch(r"[A-Za-z0-9_.:-]{2,160}", anchor.away_provider_id)
            or anchor.home_provider_id == anchor.away_provider_id):
        _deny()
    f = anchor.fixture
    slot = f.kickoff_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    key = "rpl-2026-27-r15-" + f.kickoff_at.strftime("%Y%m%d-%H%M")
    if (
        f.fixture_key != key
        or slot not in DIRECTED
        or (f.home_club_key, f.away_club_key) != DIRECTED[slot]
        or f.competition != "RPL"
        or f.season != SEASON
        or f.kickoff_at.tzinfo != UTC
        or observed_at < f.kickoff_at + MIN_RESULT_AGE
        or key not in MATCHTV_MATCH_IDS
    ):
        _deny()
    return f


def _score(home, away):
    if any(type(v) is not int or not 0 <= v <= 20 for v in (home, away)):
        _deny()


def parse_openfoot_result_candidate(
    body: bytes, anchor: A5PostmatchAnchor, observed_at: datetime,
) -> ProviderResultClaim:
    """Require a *single* exact A5 provider fixture with explicit played kind.

    If OpenFoot provides only a final score/status and no independently
    verifiable 'played' kind, fail closed rather than invent the missing fact.
    """
    fixture = _verify_anchor(anchor, observed_at)
    envelope = _json(body)
    if (type(envelope) is not dict or set(envelope) != {"data", "meta"}
            or type(envelope["data"]) is not list
            or len(envelope["data"]) != 1
            or type(envelope["meta"]) is not dict
            or envelope["meta"].get("count") != 1
            or type(envelope["meta"].get("access")) is not dict
            or envelope["meta"]["access"].get("authenticated") is not True):
        _deny()
    match = envelope["data"][0]
    if (type(match) is not dict
            or match.get("id") != fixture.source_match_id
            or match.get("competitionId") != COMPETITION
            or match.get("season") != SEASON
            or _utc(match.get("kickoffAt")) != fixture.kickoff_at
            or match.get("status") != "finished"
            or match.get("resultKind") != "played"
            or any(match.get(k) not in (None, False)
                   for k in ("awarded", "technical", "abandoned", "walkover"))
            or type(match.get("homeTeam")) is not dict
            or type(match.get("awayTeam")) is not dict):
        _deny()
    home, away = match["homeTeam"], match["awayTeam"]
    if (home.get("id") != anchor.home_provider_id
            or away.get("id") != anchor.away_provider_id
            or _club(home.get("name")) != fixture.home_club_key
            or _club(away.get("name")) != fixture.away_club_key):
        _deny()
    score = match.get("score")
    if type(score) is not dict or set(score) != {"home", "away"}:
        _deny()
    h, a = score["home"], score["away"]
    _score(h, a)
    return ProviderResultClaim(
        issuer="openfoot", source_fixture_ref=fixture.source_match_id,
        fixture_key=fixture.fixture_key, kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key, observed_at=observed_at,
        source_response_sha256=sha256(body).hexdigest(), status="finished",
        result_kind="played", home_goals=h, away_goals=a,
    )


class _MatchTVHeader(HTMLParser):
    """Extract ONLY visible top-of-page content, excluding old H2H scores."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.h1_parts: list[str] = []
        self.in_h1 = 0
        self.skip = 0
        self.closed = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template", "noscript"):
            self.skip += 1
        if tag == "h1":
            self.in_h1 += 1

    def handle_endtag(self, tag):
        if tag == "h1" and self.in_h1:
            self.in_h1 -= 1
        if tag in ("script", "style", "template", "noscript") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if self.skip or self.closed:
            return
        clean = data.strip()
        if clean == "Прошлые матчи":
            self.closed = True
        if clean:
            self.parts.append(clean)
            if self.in_h1:
                self.h1_parts.append(clean)


def _club_from_matchtv_headline(name: str) -> str:
    try:
        return _club(name)
    except DataError:
        # The MatchTV heading often includes an extra city in parentheses:
        # "Ростов (Ростов-на-Дону)"; only a *known* unambiguous alias may
        # match after removing that parenthetical, no fuzzy team mapping.
        return _club(re.sub(r"\s*\([^)]*\)", "", name))


def parse_matchtv_result_candidate(
    body: bytes, anchor: A5PostmatchAnchor, observed_at: datetime,
) -> ProviderResultClaim:
    """Require pinned fixture page's LIVE 15th-round finished-score header.

    Even a valid header does NOT authenticate a genuine played final result
    versus technical/awarded revision. A6 human/source-specific review remains.
    """
    fixture = _verify_anchor(anchor, observed_at)
    if type(body) is not bytes or not 512 <= len(body) <= MAX_MATCHTV_BYTES:
        _deny()
    parser = _MatchTVHeader()
    try:
        parser.feed(body.decode("utf-8", "strict"))
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4-A6: invalid MatchTV HTML") from exc
    title = " ".join(parser.h1_parts)
    headline = re.fullmatch(r"\s*(.*?)\s+[—–]\s+(.*?)\s*", title)
    if (headline is None or
            _club_from_matchtv_headline(headline.group(1)) != fixture.home_club_key
            or _club_from_matchtv_headline(headline.group(2)) != fixture.away_club_key):
        _deny()
    visible = re.sub(r"\s+", " ", " ".join(parser.parts))
    if (len(visible) > 80_000 or
            not re.search(r"Российская Премьер-Лига,\s*Тур\s+15\b", visible)
            or re.search(
                r"техническ|присужд|аннулир|не состоял|отмен[её]н|прерван",
                visible, re.IGNORECASE,
            )):
        _deny()
    scores = list(re.finditer(
        r"\bЗаверш[её]н\b\s+(\d{1,2}):(\d{1,2})\s+"
        r"(\d{2})\s+нояб,\s+(\d{2}):(\d{2})\b",
        visible, re.IGNORECASE,
    ))
    if len(scores) != 1:
        _deny()
    match = scores[0]
    h, a = int(match.group(1)), int(match.group(2))
    _score(h, a)
    local = fixture.kickoff_at + timedelta(hours=3)
    if (int(match.group(3)), int(match.group(4)), int(match.group(5))) != (
        local.day, local.hour, local.minute
    ):
        _deny()
    return ProviderResultClaim(
        issuer="matchtv",
        source_fixture_ref="matchtv:" + MATCHTV_MATCH_IDS[fixture.fixture_key],
        fixture_key=fixture.fixture_key, kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key, observed_at=observed_at,
        source_response_sha256=sha256(body).hexdigest(), status="finished",
        result_kind="played", home_goals=h, away_goals=a,
    )
