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

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED, _club
from football_forecast.research.m4_future_rpl_independent import (
    MATCHTV_DAYS,
    MATCHTV_NAMES,
    VisibleText,
)
from football_forecast.research.m4_future_rpl_source import (
    COMPETITION,
    SEASON,
    _json,
    _utc,
)

MAX_MATCHTV_BYTES = 8_000_000
MIN_RESULT_AGE = timedelta(minutes=90)
# MatchTV fixture ID crosswalk identified in precommitted round-15 calendar;
# The current-season calendar URL is fixed; never trust provider-supplied links.
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
# Individual MatchTV detail pages contain prior-season H2H rows and MUST
# NOT be fetched. Only the current-season 2026/27 calendar is used.


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


def parse_matchtv_result_candidate(
    body: bytes, anchor: A5PostmatchAnchor, observed_at: datetime,
) -> ProviderResultClaim:
    """Parse only the current 2026/27 round-15 calendar score *claims*.

    Individual MatchTV detail pages embed historical H2H matches from the
    sealed 2025/26 season, so the protected worker MUST NOT fetch those pages.
    A displayed score does not prove a played rather than an awarded final,
    so output deliberately uses status=score_displayed_unverified and
    result_kind=unknown. The A6 candidate comparator MUST reject it until
    separately authenticated, genuinely played-final evidence exists.
    """
    fixture = _verify_anchor(anchor, observed_at)
    if type(body) is not bytes or not 512 <= len(body) <= MAX_MATCHTV_BYTES:
        _deny()
    try:
        parser = VisibleText()
        parser.feed(body.decode("utf-8", "strict"))
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4-A6: invalid MatchTV current-season HTML") from exc
    visible = re.sub(r"\s+", " ", " ".join(parser.fragments))
    section = re.search(r"\bТур\s+15\b(.*?)\bТур\s+16\b",
                        visible, re.IGNORECASE)
    if (section is None
            or len(re.findall(r"\bТур\s+15\b", visible, re.IGNORECASE)) != 1
            or len(section.group(1)) > 80_000
            or re.search(
                r"техническ|присужд|аннулир|не состоял|отмен[её]н|прерван",
                section.group(1), re.IGNORECASE,
            )):
        _deny()
    round_text = section.group(1)
    markers = [label for label, _ in MATCHTV_DAYS]
    if any(round_text.count(marker) != 1 for marker in markers):
        _deny()
    starts = [round_text.index(marker) for marker in markers]
    if starts != sorted(starts):
        _deny()
    by_day = {}
    for i, (_, day) in enumerate(MATCHTV_DAYS):
        by_day[day] = round_text[
            starts[i] + len(markers[i]):
            starts[i + 1] if i + 1 < len(starts) else len(round_text)
        ]
    found = {}
    for slot, (home, away) in DIRECTED.items():
        expected = datetime.fromisoformat(slot.replace("Z", "+00:00"))
        text = by_day.get(expected.date().isoformat(), "")
        # Require scored-link ordering: HOME <home goals> AWAY <away goals>.
        # Reject HOME AWAY HH:MM because even 10:00 could be a kickoff time.
        pair = re.compile(
            r"(?<!\w)" + re.escape(MATCHTV_NAMES[home]) +
            r"\s+(\d{1,2})\s+" + re.escape(MATCHTV_NAMES[away]) +
            r"\s+(\d{1,2})(?!\w)",
            re.IGNORECASE,
        )
        matches = list(pair.finditer(text))
        if len(matches) != 1:
            _deny()
        h, a = int(matches[0].group(1)), int(matches[0].group(2))
        _score(h, a)
        found[slot] = (h, a)
    if set(found) != set(DIRECTED):
        _deny()
    home_goals, away_goals = found[
        fixture.kickoff_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    ]
    return ProviderResultClaim(
        issuer="matchtv",
        source_fixture_ref="matchtv:" + MATCHTV_MATCH_IDS[fixture.fixture_key],
        fixture_key=fixture.fixture_key, kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key, observed_at=observed_at,
        # A calendar score can NEVER, by itself, assert played/finished.
        # Both claims must be separately established before A6 admission.
        source_response_sha256=sha256(body).hexdigest(),
        status="score_displayed_unverified", result_kind="unknown",
        home_goals=home_goals, away_goals=away_goals,
    )
