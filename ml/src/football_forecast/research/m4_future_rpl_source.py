"""M4-A5 read-only prospective fixture-source observation, never forecasting.

Strict, *predeclared* 15th-round RPL 2026/27 calendar based on independent
public schedules verified 11 Nov 2026 (MatchTV, Championat). No 2025/26.
A positive source probe only proves that a response was observed after M4
began. It does NOT certify the provider's first-serving UTC, the captured
data's independence or authorization to write a private forecast.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from json import dumps, loads
from math import isfinite

from football_forecast.data.contracts import DataError

COMPETITION = "comp_premier_league_rus"
SEASON = "2026/27"
M4_START = datetime(2026, 11, 11, 11, 4, 56, tzinfo=UTC)
CALENDAR = {
    "2026-11-20": ("16:30",),
    "2026-11-21": ("10:00", "12:15", "14:30", "16:45"),
    "2026-11-22": ("11:00", "13:30", "16:00"),
}
FIRST_KICKOFF = datetime(2026, 11, 20, 16, 30, tzinfo=UTC)
MAX_BYTES_PER_DAY = 150_000


@dataclass(frozen=True, slots=True)
class FutureSourceReceipt:
    source: str
    classification: str
    first_observed_utc: str
    source_envelopes_sha256: str
    days: int
    fixtures: int
    club_identities: int
    private_shadow_only: bool = True
    independent_source_confirmed: bool = False
    genuine_as_of_attested: bool = False
    model_approved: bool = False
    forecast_written: bool = False
    public_forecasts_written: bool = False
    holdout_2025_26_read: bool = False


def _reject(msg: str):
    raise DataError("M4 future source observation: " + msg)


def _json(blob: bytes):
    if type(blob) is not bytes or not 2 <= len(blob) <= MAX_BYTES_PER_DAY:
        _reject("missing or oversized source response")

    def pairs(values):
        result = {}
        for k, v in values:
            if k in result:
                _reject("duplicate JSON object key")
            result[k] = v
        return result

    def invalid_constant(value):
        _reject("non-JSON numeric constant")

    try:
        return loads(blob.decode("utf-8", errors="strict"),
                     object_pairs_hook=pairs, parse_constant=invalid_constant)
    except (ValueError, UnicodeDecodeError) as exc:
        raise DataError("M4 future source observation: invalid JSON") from exc


def _utc(value):
    if type(value) is not str:
        _reject("invalid kickoff type")
    # Allow documented RFC3339 seconds or exactly .000Z; no local/offset time.
    if not (
        len(value) == 20 and value.endswith("Z")
        or len(value) == 24 and value.endswith(".000Z")
    ):
        _reject("noncanonical provider UTC kickoff")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise DataError("M4 future source observation: invalid UTC datetime") from exc
    if timestamp.tzinfo != UTC or timestamp.microsecond:
        _reject("provider time is not UTC seconds")
    return timestamp


def inspect_future_rpl_source(
    days: dict[str, bytes], observed_at: datetime,
) -> FutureSourceReceipt:
    if type(days) is not dict or set(days) != set(CALENDAR):
        _reject("missing or unexpected source dates")
    if (not isinstance(observed_at, datetime) or observed_at.tzinfo != UTC
            or not M4_START < observed_at < FIRST_KICKOFF
            or (FIRST_KICKOFF - observed_at).total_seconds() < 900):
        _reject("not freshly observed before future first kickoff")
    match_ids: set[str] = set()
    club_ids: set[str] = set()
    fingerprints = []
    for day, expected_times in CALENDAR.items():
        raw = days[day]
        data = _json(raw)
        if type(data) is not dict or set(data) != {"data", "meta"}:
            _reject("unrecognized response envelope")
        rows = data["data"]
        meta = data["meta"]
        if (type(rows) is not list or len(rows) != len(expected_times)
                or type(meta) is not dict or meta.get("count") != len(rows)
                or type(meta.get("access")) is not dict
                or meta["access"].get("authenticated") is not True):
            _reject("source pagination or access mismatch")
        observed_times = []
        for row in rows:
            if (type(row) is not dict or row.get("competitionId") != COMPETITION
                    or row.get("season") != SEASON
                    or row.get("status") != "scheduled"
                    or type(row.get("id")) is not str
                    or not 2 <= len(row["id"]) <= 160
                    or row["id"] in match_ids):
                _reject("out-of-scope or duplicated fixture")
            home, away = row.get("homeTeam"), row.get("awayTeam")
            if type(home) is not dict or type(away) is not dict:
                _reject("missing directed club mapping")
            for team in (home, away):
                name, key = team.get("name"), team.get("id")
                if (type(name) is not str or not name.strip()
                        or type(key) is not str or not 2 <= len(key) <= 160):
                    _reject("missing team identity")
            if home["id"] == away["id"]:
                _reject("self match")
            if row.get("score") is not None:
                if type(row["score"]) is not dict or any(
                    row["score"].get(k) is not None for k in ("home", "away")
                ):
                    _reject("finished score in future fixture")
            kickoff = _utc(row.get("kickoffAt"))
            if kickoff.date().isoformat() != day:
                _reject("unexpected UTC fixture day")
            observed_times.append(kickoff.strftime("%H:%M"))
            match_ids.add(row["id"])
            club_ids.update((home["id"], away["id"]))
        if tuple(sorted(observed_times)) != expected_times:
            _reject("kickoff times disagree with independently pinned calendar")
        fingerprints.append((day, sha256(raw).hexdigest()))
    if len(match_ids) != 8 or len(club_ids) != 16:
        _reject("noncomplete eight-game sixteen-club round")
    digest = sha256(dumps(fingerprints, separators=(",", ":"),
                          sort_keys=True).encode("utf-8")).hexdigest()
    return FutureSourceReceipt(
        source="OpenFoot Starter (private source only)",
        classification="UNAPPROVED_PRIVATE_FUTURE_SOURCE_OBSERVATION",
        first_observed_utc=observed_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        source_envelopes_sha256=digest,
        days=3, fixtures=8, club_identities=16,
    )
