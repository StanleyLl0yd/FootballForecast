"""Closed, calendar-only OpenFootball training candidate: no invented kickoffs."""
from collections import Counter
from dataclasses import dataclass
from datetime import date
from re import fullmatch

from football_forecast.data.contracts import DataError

PROTOCOL = "m2-openfootball-calendar-v1"
REFERENCE_COMMIT = "63df627f3c87ce71708f016522ea236cf74332c3"
REFERENCE_BLOB = "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc"
_SHA = r"[a-f0-9]{64}"
_ALIAS = r"S_[A-F0-9]{20}"
_MATCH = r"OF_[A-F0-9]{24}"


@dataclass(frozen=True, slots=True)
class CalendarTrainingFixture:
    match_id: str
    calendar_date_utc: date
    round: int
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int


def read_openfootball_calendar_training(value: object) -> tuple[
    tuple[CalendarTrainingFixture, ...], str
]:
    """Validate pinned-source bridge output. Trust source bytes only in the owner workflow."""
    if type(value) is not dict or set(value) != {
        "schemaVersion", "kind", "protocol", "season", "role", "sourceLicense",
        "sourceCommit", "sourceGitBlobSha1", "sourceBytesSha256",
        "historicalPrematchVerified", "fixtures",
    }:
        raise DataError("M2 OpenFootball: unknown training envelope")
    expected = {
        "schemaVersion": 1,
        "kind": "M2_OPENFOOTBALL_CALENDAR_TRAIN_INPUT",
        "protocol": PROTOCOL,
        "season": "2024/2025",
        "role": "train_baseline",
        "sourceLicense": "CC0-1.0",
        "sourceCommit": REFERENCE_COMMIT,
        "sourceGitBlobSha1": REFERENCE_BLOB,
        "historicalPrematchVerified": False,
    }
    if any(type(value.get(k)) is not type(v) or value[k] != v
           for k, v in expected.items()):
        raise DataError("M2 OpenFootball: source, role or timing contract invalid")
    source_sha = value["sourceBytesSha256"]
    if not isinstance(source_sha, str) or not fullmatch(_SHA, source_sha):
        raise DataError("M2 OpenFootball: invalid source fingerprint")
    rows = value["fixtures"]
    if type(rows) is not list or len(rows) != 240:
        raise DataError("M2 OpenFootball: expected exactly 240 matches")
    records = []
    per_round: dict[int, set[str]] = {}
    seen_ids: set[str] = set()
    seen_pairs: set[tuple[str, str]] = set()
    for row in rows:
        if type(row) is not dict or set(row) != {
            "matchId", "calendarDateUtc", "round", "homeTeamId",
            "awayTeamId", "homeGoals", "awayGoals", "resultType",
        }:
            raise DataError("M2 OpenFootball: unknown or missing match field")
        match_id, home, away = (row[k] for k in ("matchId", "homeTeamId", "awayTeamId"))
        if (not isinstance(match_id, str) or not fullmatch(_MATCH, match_id)
                or not isinstance(home, str) or not fullmatch(_ALIAS, home)
                or not isinstance(away, str) or not fullmatch(_ALIAS, away)
                or home == away or match_id in seen_ids or (home, away) in seen_pairs):
            raise DataError("M2 OpenFootball: duplicate or invalid team/fixture")
        day_text = row["calendarDateUtc"]
        if type(day_text) is not str or not fullmatch(r"202[45]-\d{2}-\d{2}", day_text):
            raise DataError("M2 OpenFootball: missing calendar date")
        try:
            day = date.fromisoformat(day_text)
        except ValueError as exc:
            raise DataError("M2 OpenFootball: impossible calendar date") from exc
        if not date(2024, 7, 1) <= day < date(2025, 7, 1):
            raise DataError("M2 OpenFootball: record outside training season")
        matchday = row["round"]
        if (type(matchday) is not int or not 1 <= matchday <= 30
                or type(row["homeGoals"]) is not int or type(row["awayGoals"]) is not int
                or not 0 <= row["homeGoals"] <= 20
                or not 0 <= row["awayGoals"] <= 20
                or row["resultType"] != "played"):
            raise DataError("M2 OpenFootball: invalid round, status or score")
        teams = per_round.setdefault(matchday, set())
        if home in teams or away in teams:
            raise DataError("M2 OpenFootball: club duplicated in matchday")
        teams.update((home, away))
        seen_ids.add(match_id)
        seen_pairs.add((home, away))
        records.append(CalendarTrainingFixture(
            match_id, day, matchday, home, away,
            row["homeGoals"], row["awayGoals"],
        ))
    counts = Counter(team for f in records for team in (f.home_team_id, f.away_team_id))
    if (len(counts) != 16 or any(count != 30 for count in counts.values())
            or set(per_round) != set(range(1, 31))
            or any(len(teams) != 16 for teams in per_round.values())):
        raise DataError("M2 OpenFootball: incomplete 16-team round robin")
    if records != sorted(records, key=lambda f: (f.calendar_date_utc, f.match_id)):
        raise DataError("M2 OpenFootball: noncanonical fixture ordering")
    return tuple(records), source_sha
