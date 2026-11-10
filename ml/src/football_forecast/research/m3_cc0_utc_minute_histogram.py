"""Pure public historical clock parsing and private-safe M3 evidence validation.

A public clock interpreted in Europe/Moscow is NOT an authenticated original
kickoff or first-available publication instant. No I/O, database or model code.
"""
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from football_forecast.data.contracts import DataError

KIND = "M3_FIVE_CC0_PUBLIC_RETROSPECTIVE_UTC_MINUTE_HISTOGRAM"
SCOPE = "FIVE_DEV_SEASONS_ONLY_READ_ONLY_ANONYMOUS_MINUTE_COUNT_AGGREGATES"
INVENTORY = "M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json"
MOSCOW = ZoneInfo("Europe/Moscow")
TIME = re.compile(r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
DAY = re.compile(
    r"^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+"
    r"([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?\s*$"
)
SCORE = re.compile(r"\s+[0-9]+-[0-9]+(?:\s+\([0-9]+-[0-9]+\))?\s*$")
YEAR = re.compile(r"^20[12][0-9]/[12][0-9]$")
MONTHS = {key: i for i, key in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1
)}
ROWS = (
    ("2018/19", "openfootball/football.json",
     "7ae2641d5504dac76f0ecbb84ca723ca36d03f82", "JSON", 240, 0, 229, 221, 38, 38),
    ("2019/20", "openfootball/football.json",
     "25a5738b595d9b6d074208e4e5df47f2c2a9bcc3", "JSON", 238, 2, 212, 221, 36, 36),
    ("2020/21", "openfootball/football.json",
     "48f77704081ac4405b98341c81b02b4664536733", "JSON", 238, 2, 197, 237, 4, 4),
    ("2023/24", "openfootball/europe",
     "3ea6829a971d1cbdf56552be0519cc125707bd99", "FOOTBALL_TXT", 221, 19, 221,
     221, 19, 13),
    ("2024/25", "openfootball/europe",
     "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc", "FOOTBALL_TXT", 216, 24, 216,
     216, 24, 18),
)
DENIALS = (
    "publicTimeZoneMetadataFirstPublishedValidated",
    "historicalKickoffOriginalUtcAuthenticated", "privateFixtureIdsExported",
    "privateMatchRowsExported", "privateUtcMinuteHistogramExported",
    "sourceClocksIndependentlyHistoricalAsOfVerified",
    "actualOnFieldKickoffMinutesVerified", "publicMissingTimesFilled",
    "sourceRightsVerified", "fullSevenSeasonCoverageProven",
    "privateClubIdentityMapped", "playedResultStatusVerified",
    "realModelTrainingAuthorized", "holdout2025_26Read",
    "productionModelChanged", "m3A3Accepted",
)


def _deny(message: str) -> None:
    raise DataError("M3 public minute histogram: " + message)


@dataclass(frozen=True, slots=True)
class PublicClockHistogram:
    matches: int
    available_clocks: int
    missing_clocks: int
    minutes: Counter


def _instant(date_text: str, local_time: str) -> datetime:
    if type(date_text) is not str or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_text):
        _deny("invalid public date")
    if type(local_time) is not str or TIME.fullmatch(local_time) is None:
        _deny("invalid public time")
    try:
        local = datetime.fromisoformat(date_text + "T" + local_time).replace(tzinfo=MOSCOW)
        return local.astimezone(UTC)
    except ValueError:
        _deny("nonexistent calendar date")


def public_utc_minute_histogram(raw: str, fmt: str, season: str) -> PublicClockHistogram:
    """Interpret Moscow-local PUBLIC clocks; never fill a missing clock."""
    if type(raw) is not str or not raw.strip():
        _deny("empty public source")
    if type(season) is not str or YEAR.fullmatch(season) is None:
        _deny("invalid development season")
    if season not in {row[0] for row in ROWS}:
        _deny("season outside pinned development scope")
    dates_and_times = []
    if fmt == "JSON":
        try:
            source = json.loads(raw)
        except (ValueError, TypeError):
            _deny("invalid public JSON")
        if type(source) is not dict or type(source.get("matches")) is not list:
            _deny("missing matches")
        for match in source["matches"]:
            if type(match) is not dict:
                _deny("invalid public fixture")
            if type(match.get("score")) is not dict or not (
                type(match["score"].get("ft")) is list
                and len(match["score"]["ft"]) == 2
            ):
                _deny("missing full-time score shape")
            dates_and_times.append((match.get("date"), match.get("time")))
    elif fmt == "FOOTBALL_TXT":
        day_text = None
        start_year = int(season[:4])
        for line in raw.splitlines():
            d = DAY.fullmatch(line)
            if d is not None:
                month = MONTHS.get(d[1])
                if month is None:
                    _deny("unknown month")
                year = int(d[3]) if d[3] is not None else (
                    start_year if month >= 7 else start_year + 1
                )
                try:
                    day_text = datetime(year, month, int(d[2])).strftime("%Y-%m-%d")
                except ValueError:
                    _deny("invalid public date header")
                continue
            if " v " not in line:
                continue
            if SCORE.search(line) is None or day_text is None:
                _deny("fixture missing score or dated header")
            t = re.match(r"^\s*(\d{1,2}:\d{2})\s+", line)
            date_with_clock = None if t is None else t[1].zfill(5)
            dates_and_times.append((day_text, date_with_clock))
    else:
        _deny("unsupported public format")
    if len(dates_and_times) != 240:
        _deny("season has missing or excess fixtures")
    year = int(season[:4])
    start = datetime(year, 7, 1).date()
    stop = (datetime(2020, 8, 1).date() if season == "2019/20"
            else datetime(year + 1, 7, 1).date())
    histogram = Counter()
    for day, local_clock in dates_and_times:
        if type(day) is not str:
            _deny("missing fixture date")
        try:
            event_date = datetime.strptime(day, "%Y-%m-%d").date()
        except ValueError:
            _deny("invalid fixture date")
        if not start <= event_date < stop:
            _deny("public fixture date outside source development season")
        if local_clock is None:
            continue
        histogram[_instant(day, local_clock)] += 1
    available = sum(histogram.values())
    return PublicClockHistogram(240, available, 240 - available, histogram)


@dataclass(frozen=True, slots=True)
class MinuteReceiptAudit:
    public_fixtures: int = 1200
    public_available_clock_count: int = 1153
    anonymous_exact_minute_overlap: int = 1116
    independent_historically_authenticated_kickoffs: int = 0
    m3_a3_accepted: bool = False


def audit_public_minute_histogram_receipt(data: object) -> MinuteReceiptAudit:
    """Pin anonymous evidence only; not proof of original SQL or first-serving."""
    if type(data) is not dict or set(data) != {
        "schemaVersion", "kind", "observedOn", "scope", "sourceInventory",
        "sourceRows", "aggregate", "interpretation", "limitations",
    }:
        _deny("invalid evidence object or extra keys")
    if (type(data["schemaVersion"]) is not int or data["schemaVersion"] != 1
            or data["kind"] != KIND or data["observedOn"] != "2026-11-10"
            or data["scope"] != SCOPE or data["sourceInventory"] != INVENTORY):
        _deny("provenance or development scope changed")
    if data["interpretation"] != (
        "Source-clock conversion from Moscow time (UTC+3) explains strong aggregate "
        "coincidence; not independent source first-serving or actual played kickoff "
        "certification; clocks missing from public sources remain null, not fabricated."
    ):
        _deny("temporal limitation lost")
    public = data["sourceRows"]
    if type(public) is not list or len(public) != 5:
        _deny("five pinned source rows required")
    for entry, spec in zip(public, ROWS, strict=True):
        if type(entry) is not dict:
            _deny("invalid source row")
        season, repo, blob, fmt, available, missing, distinct, exact, l1, bins = spec
        expected = {
            "season": season, "publisherRepo": repo, "pinnedPublicBlob": blob,
            "format": fmt, "publicFixtureRows": 240,
            "publicClockedRows": available, "publicWithoutClock": missing,
            "publicDistinctUtcMinuteBins": distinct,
            "privateProviderFinishedRows": 240,
            "exactUtcMinuteOverlapCount": exact, "utcMinuteHistogramL1": l1,
            "differingUtcMinuteBins": bins,
            "conversionAssumption": "Europe/Moscow_LOCAL_TO_UTC",
            "originalSourceTimeZoneIndependentlyVerified": False,
            "sourceFirstPublicationVerified": False,
            "actualOnFieldKickoffVerified": False,
            "privateFixtureIdentityVerified": False,
        }
        int_fields = (
            "publicFixtureRows", "publicClockedRows", "publicWithoutClock",
            "publicDistinctUtcMinuteBins", "privateProviderFinishedRows",
            "exactUtcMinuteOverlapCount", "utcMinuteHistogramL1",
            "differingUtcMinuteBins",
        )
        if entry != expected or any(type(entry[k]) is not int for k in int_fields):
            _deny("source clocks, public counts or private aggregate changed")
    expected_total = {
        "publicFixtureRows": 1200,
        "publicClockedRows": 1153,
        "publicWithoutClock": 47,
        "privateProviderFinishedRows": 1200,
        "exactUtcMinuteOverlapCount": 1116,
        "publicClockedRowsNotOverlapping": 37,
        "privateRowsNotOverlapping": 84,
        "minuteHistogramL1": 121,
        "independentlyCertifiedFixtureKickoffs": 0,
    }
    total = data["aggregate"]
    if (type(total) is not dict or total != expected_total
            or any(type(total[k]) is not int for k in expected_total)):
        _deny("aggregate or certified-time count changed")
    limitations = data["limitations"]
    if (type(limitations) is not dict or set(limitations) != set(DENIALS)
            or any(limitations[k] is not False for k in DENIALS)):
        _deny("denial or privacy invariant violated")
    return MinuteReceiptAudit()
