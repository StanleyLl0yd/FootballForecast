"""M3 official Sochi scheduled UTC minute receipt; private aggregate-only validation."""
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from football_forecast.data.contracts import DataError

PROTOCOL = "M3_OFFICIAL_SCHEDULED_UTC_MASK_CORROBORATION"
SCOPE = "SEVEN_SEASON_SELECT_ONLY_MASK_DIRECTION_EXACT_UTC_MINUTE"
PREVIOUS = "M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json"
EVENTS = (
    ("sochi_spartak_a", "2023-09-16", "2023-09-13",
     "https://pfcsochi.ru/news/2023-2024/informatsiya-dlya-bolelshchikov-o-matche-so-spartakom/",
     "spartak", "sochi", 127, 62, "2023-09-16T19:00:00", "2023-09-16T16:00:00Z"),
    ("sochi_spartak_b", "2024-04-13", "2024-04-08",
     "https://pfcsochi.ru/news/2023-2024/akkreditatsiya-smi-na-match-so-spartakom/",
     "sochi", "spartak", 62, 127, "2024-04-13T14:00:00", "2024-04-13T11:00:00Z"),
)
FIELDS = {
    "key", "season", "dayUtc", "articleDate", "articleUrl", "homeAlias",
    "awayAlias", "homeMask", "awayMask", "scheduledLocalMoscow", "scheduledUtc",
    "privateDayMatches", "privateMaskDirectionCount", "exactUtcMinuteCount",
    "withinHourCount",
}
LIMITS = {
    "privateIdsExported", "privateRowsExported", "scoreFieldsRead",
    "privateSpartakIdVerified", "actualKickoffVerified", "originalFirstServingUtcVerified",
    "playedGoalStatusVerified", "sourceTrainingRightsVerified",
    "realTrainingAuthorized", "holdout2025_26Read", "publicPredictionsWritten",
}


@dataclass(frozen=True, slots=True)
class MinuteCorroboration:
    exact_minute_candidates: int
    certified_private_team_links: int = 0
    eligible_played_rows: int = 0
    actual_kickoff_verified: bool = False
    historical_first_serving_verified: bool = False
    real_training_authorized: bool = False
    holdout_read: bool = False


def _deny(reason: str) -> None:
    raise DataError("M3 official scheduled minute: " + reason)


def audit_official_scheduled_minute(current: dict, prior: dict) -> MinuteCorroboration:
    """Cross-check pinned counts without granting original-match provenance."""
    if type(current) is not dict or set(current) != {
        "schemaVersion", "kind", "observedOn", "scope",
        "previousEvidence", "events", "aggregate", "limitations",
    }:
        _deny("unknown receipt envelope")
    if (type(current["schemaVersion"]) is not int or current["schemaVersion"] != 1
            or current["kind"] != PROTOCOL or current["observedOn"] != "2026-11-10"
            or current["scope"] != SCOPE or current["previousEvidence"] != PREVIOUS):
        _deny("incorrect scope or provenance")
    limits = current["limitations"]
    if (type(limits) is not dict or set(limits) != LIMITS
            or any(limits[f] is not False for f in LIMITS)):
        _deny("uncertified claim, private disclosure, or holdout access")
    if (type(prior) is not dict or prior.get("kind") !=
            "M3_AGGREGATE_ONLY_PUBLIC_EVENT_TO_PRIVATE_MEMBERSHIP_MASK_DATE_CANDIDATES"
            or type(prior.get("events")) is not list or len(prior["events"]) != 8):
        _deny("missing eight-event calendar baseline")
    old = {}
    for row in prior["events"]:
        if type(row) is not dict or type(row.get("eventKey")) is not str:
            _deny("invalid prior event")
        if row["eventKey"] in old:
            _deny("duplicate prior event")
        old[row["eventKey"]] = row
    rows = current["events"]
    if type(rows) is not list or len(rows) != 2:
        _deny("exactly two official prematch events required")
    for row, ref in zip(rows, EVENTS, strict=True):
        if type(row) is not dict or set(row) != FIELDS:
            _deny("unknown event or leaked private field")
        key, day, article, url, home, away, mask_h, mask_a, local, utc = ref
        expected = {
            "key": key, "season": "2023/24", "dayUtc": day,
            "articleDate": article, "articleUrl": url, "homeAlias": home,
            "awayAlias": away, "homeMask": mask_h, "awayMask": mask_a,
            "scheduledLocalMoscow": local, "scheduledUtc": utc,
        }
        if any(type(row[k]) is not type(v) or row[k] != v for k, v in expected.items()):
            _deny("official source, date, direction, or schedule changed")
        # This converts scheduled Moscow local time, NOT actual kickoff or
        # authenticated first-serving time of the original article.
        converted = datetime.fromisoformat(local).replace(
            tzinfo=ZoneInfo("Europe/Moscow")
        ).astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        if converted != utc or not article < day:
            _deny("local-to-UTC conversion or article date invalid")
        previous = old.get(key)
        if (previous is None or previous.get("season") != "2023/24"
                or previous.get("dayUtc") != day or previous.get("publicClubAlias") != "sochi"
                or previous.get("publicSevenSeasonMask") != 62
                or previous.get("publicRole") != "either"
                or previous.get("matchingMaskRoleCount") != 1
                or previous.get("allSevenSeasonOpponentPairCount") != 1
                or previous.get("privateMatchesOnSameUtcDay") != 4):
            _deny("earlier mask/day observation contradicts new evidence")
        for key_count, count in (
            ("privateDayMatches", 4), ("privateMaskDirectionCount", 1),
            ("exactUtcMinuteCount", 1), ("withinHourCount", 1)
        ):
            if type(row[key_count]) is not int or row[key_count] != count:
                _deny("private count is unverified, missing, or ambiguous")
    agg = current["aggregate"]
    if (type(agg) is not dict or set(agg) != {
        "minuteCandidates", "certifiedPrivateTeamLinks", "eligiblePlayedRows"
    } or any(type(agg[k]) is not int or agg[k] != value for k, value in (
        ("minuteCandidates", 2), ("certifiedPrivateTeamLinks", 0),
        ("eligiblePlayedRows", 0)
    ))):
        _deny("aggregate overstates independent approval")
    return MinuteCorroboration(exact_minute_candidates=2)
