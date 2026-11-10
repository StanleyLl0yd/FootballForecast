"""A3 nine-match Sochi schedule/anonymous graph receipt, SELECT-only evidence.

Not independent club-to-provider-ID mapping, played kickoff, result-status or
first-serving proof. No private IDs or rows are read by this module.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_official_scheduled_minute import (
    audit_official_scheduled_minute,
)

KIND = "M3_NINE_OFFICIAL_RETROSPECTIVE_UTC_MINUTE_ANONYMOUS_GRAPH"
SCOPE = "SEVEN_DEVELOPMENT_SEASONS_SELECT_ONLY_NO_SCORE_OR_IDS"
SOURCE_DOCS = {
    "rfsCalendar": "https://www.rfs.ru/tournament/1434/calendar?round_id=18568",
    "clubProvisionalAugust": (
        "https://pfcsochi.ru/news/2023-2024/"
        "rossiyskaya-premer-liga-predstavlyaet-raspisanie-"
        "matchey-mir-rpl-s-8-go-po-15-y-tury/"
    ),
    "clubVenueSwapSeptember": (
        "https://pfcsochi.ru/news/2023-2024/"
        "rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-"
        "sochi-i-spartakom/"
    ),
    "clubAprilPrematch": (
        "https://pfcsochi.ru/news/2023-2024/"
        "akkreditatsiya-smi-na-match-so-spartakom/"
    ),
}
# Public original schedules can be revised; these times are the *currently
# displayed official schedule*, not authenticated historical as-of UTC.
FIXTURES = (
    ("sochi_spartak_a", "2023-09-16", "spartak", "sochi", 127, 62, "19:00", "16:00", 4, True),
    ("sochi_krylia_sep23", "2023-09-23", "krylia", "sochi", 123, 62, "14:00", "11:00", 3, False),
    ("sochi_fakel_oct01", "2023-10-01", "fakel", "sochi", 112, 62, "14:00", "11:00", 3, False),
    ("sochi_zenit_oct07", "2023-10-07", "sochi", "zenit", 62, 127, "14:00", "11:00", 4, False),
    ("sochi_ural_oct22", "2023-10-22", "ural", "sochi", 63, 62, "12:00", "09:00", 4, True),
    ("sochi_pari_oct29", "2023-10-29", "nizhny_novgorod", "sochi",
     120, 62, "14:00", "11:00", 3, False),
    ("sochi_dynamo_nov06", "2023-11-06", "sochi", "dinamo_moscow",
     62, 127, "19:30", "16:30", 3, False),
    ("sochi_rubin_nov12", "2023-11-12", "sochi", "rubin", 62, 111, "19:00", "16:00", 4, False),
    ("sochi_spartak_b", "2024-04-13", "sochi", "spartak", 62, 127, "14:00", "11:00", 4, False),
)
EVENT_FIELDS = {
    "eventCode", "season", "dayUtc", "homeAlias", "awayAlias", "homeMask",
    "awayMask", "scheduledLocalMoscow", "scheduledUtc",
    "privateDayMatches", "privateMaskDirectionCount", "exactUtcMinuteCount",
    "withinHourCount", "earlyPublicScheduleConflict",
}
NEGATIVE_GATES = (
    "privateIdsExported", "privateRowsExported", "scoreFieldsRead",
    "privateOfficialClubIdMapVerified", "actualKickoffVerified",
    "originalFirstServingUtcVerified", "playedGoalStatusVerified",
    "sourceTrainingRightsVerified", "realTrainingAuthorized",
    "holdout2025_26Read", "publicPredictionsWritten",
)
GRAPH = {
    "exactMinuteCandidateRows": 9,
    "eventsCovered": 9,
    "sochiAnonymousIds": 1,
    "distinctOpponentIds": 8,
    "distinctMask127OpponentIds": 3,
    "reciprocalSpartakCandidateIds": 1,
    "singletonOpponentIds": 5,
    "certifiedPrivateClubLinks": 0,
    "eligiblePlayedRows": 0,
}


@dataclass(frozen=True, slots=True)
class NineMinuteAudit:
    matched_events: int = 9
    distinct_anonymous_opponents: int = 8
    certified_private_club_links: int = 0
    eligible_played_rows: int = 0
    real_training_authorized: bool = False
    holdout_read: bool = False


def _deny(reason: str) -> None:
    raise DataError("M3 nine official minutes: " + reason)


def audit_nine_official_minutes(
    current: dict, previous: dict, previous_calendar: dict,
) -> NineMinuteAudit:
    """Pin nine aggregate-only matches while keeping every release gate closed."""
    audit_official_scheduled_minute(previous, previous_calendar)
    if type(current) is not dict or set(current) != {
        "schemaVersion", "kind", "observedOn", "scope", "sourceDocuments",
        "priorOfficialMinutes", "priorCalendarMask", "events",
        "anonymousGraph", "limitations",
    }:
        _deny("unrecognized receipt envelope or extra private fields")
    if (type(current["schemaVersion"]) is not int or current["schemaVersion"] != 1
            or current["kind"] != KIND or current["observedOn"] != "2026-11-10"
            or current["scope"] != SCOPE
            or current["sourceDocuments"] != SOURCE_DOCS
            or current["priorOfficialMinutes"] != "M3_OFFICIAL_SCHEDULED_UTC_EVIDENCE.json"
            or current["priorCalendarMask"] != "M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json"):
        _deny("source, date or scope changed")
    limits = current["limitations"]
    if (type(limits) is not dict or set(limits) != set(NEGATIVE_GATES)
            or any(limits[x] is not False for x in NEGATIVE_GATES)):
        _deny("false private club link, model approval, holdout read or disclosure")
    graph = current["anonymousGraph"]
    if (type(graph) is not dict or set(graph) != set(GRAPH)
            or any(type(graph[k]) is not int or graph[k] != v for k, v in GRAPH.items())):
        _deny("invalid anonymous graph, duplicate or unverified approval")
    records = current["events"]
    if type(records) is not list or len(records) != len(FIXTURES):
        _deny("wrong event count")
    if len({row.get("eventCode") for row in records if type(row) is dict}) != len(FIXTURES):
        _deny("duplicate or invalid event keys")
    prior_by_key = {x["key"]: x for x in previous["events"]}
    for record, fixture in zip(records, FIXTURES, strict=True):
        if type(record) is not dict or set(record) != EVENT_FIELDS:
            _deny("unknown event field or private disclosure")
        key, day, home, away, hm, am, local, utc, day_count, conflict = fixture
        expected = {
            "eventCode": key, "season": "2023/24", "dayUtc": day,
            "homeAlias": home, "awayAlias": away, "homeMask": hm, "awayMask": am,
            "scheduledLocalMoscow": day + "T" + local + ":00",
            "scheduledUtc": day + "T" + utc + ":00Z",
            "privateDayMatches": day_count, "privateMaskDirectionCount": 1,
            "exactUtcMinuteCount": 1, "withinHourCount": 1,
            "earlyPublicScheduleConflict": conflict,
        }
        if any(type(record[k]) is not type(v) or record[k] != v
               for k, v in expected.items()):
            _deny("fixture, time, mask, count or early schedule discrepancy changed")
        converted = datetime.fromisoformat(record["scheduledLocalMoscow"]).replace(
            tzinfo=ZoneInfo("Europe/Moscow")
        ).astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        if converted != record["scheduledUtc"]:
            _deny("local-to-UTC conversion is invalid")
        if key in ("sochi_spartak_a", "sochi_spartak_b"):
            before = prior_by_key.get(key)
            if (before is None or any(before[f] != record[g] for f, g in (
                ("scheduledUtc", "scheduledUtc"),
                ("scheduledLocalMoscow", "scheduledLocalMoscow"),
                ("dayUtc", "dayUtc"),
                ("homeAlias", "homeAlias"),
                ("awayAlias", "awayAlias"),
                ("homeMask", "homeMask"),
                ("awayMask", "awayMask"),
                ("privateDayMatches", "privateDayMatches"),
                ("privateMaskDirectionCount", "privateMaskDirectionCount"),
                ("exactUtcMinuteCount", "exactUtcMinuteCount"),
                ("withinHourCount", "withinHourCount"),
            ))):
                _deny("contradicts two prior official-minute observations")
    return NineMinuteAudit()
