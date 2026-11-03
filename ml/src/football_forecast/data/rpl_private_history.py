"""Private 7-season RPL source-only storage. No training, evaluation or API surface."""
import json
import os
import re
import sys
from collections import Counter
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

from football_forecast.data.contracts import DataError

SEASONS = tuple(f"{year}/{(year + 1) % 100:02d}" for year in range(2018, 2025))
HEX = re.compile(r"[a-f0-9]{64}\Z")
ID = re.compile(r"[A-Za-z0-9_-]{2,160}\Z")
UTC_DATE = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z\Z")
DOCUMENT_FIELDS = {
    "codeSha", "kind", "observedAtUtc", "researchRole", "runId",
    "schemaVersion", "seasons", "source",
}
SEASON_FIELDS = {"fixtures", "normalizedRowsSha256", "season", "sourceResponsesSha256"}
ROW_FIELDS = {
    "awayGoals", "awayTeamId", "homeGoals", "homeTeamId", "kickoffAt", "sourceMatchId",
}
_INSERT_SNAPSHOT = """
insert into ff_private.ff_rpl_history_snapshots (
  season, source_responses_sha256, normalized_rows_sha256, retrieved_at,
  github_run_id, source_response_pages, fixture_count
) values (%s,%s,%s,%s,%s,17,240)
on conflict do nothing returning id
"""
_FIND_SNAPSHOT = """
select id from ff_private.ff_rpl_history_snapshots
where season=%s and normalized_rows_sha256=%s
"""
_INSERT_MATCH = """
insert into ff_private.ff_rpl_history_matches (
  snapshot_id,source_match_id,home_team_id,away_team_id,kickoff_at,
  home_goals,away_goals
) values (%s,%s,%s,%s,%s,%s,%s)
"""
_VERIFY_STORED = """
select source_match_id,home_team_id,away_team_id,kickoff_at,home_goals,away_goals
from ff_private.ff_rpl_history_matches where snapshot_id=%s
"""


def _require(condition: bool, reason: str) -> None:
    if not condition:
        raise DataError("M2 RPL private history: " + reason)


def _timestamp(value: object) -> datetime:
    _require(isinstance(value, str) and UTC_DATE.fullmatch(value) is not None,
             "invalid UTC time")
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise DataError("M2 RPL private history: impossible time") from exc
    _require(instant.utcoffset().total_seconds() == 0, "non-UTC time")
    return instant.astimezone(UTC)


def _hash_fixture_rows(rows: list[dict]) -> str:
    return sha256(json.dumps(
        rows, sort_keys=True, ensure_ascii=False, separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")).hexdigest()


def validate_history_document(document: object) -> tuple[dict, tuple[tuple[dict, ...], ...]]:
    """Validate a closed-source-only schema before any database connection."""
    _require(type(document) is dict and set(document) == DOCUMENT_FIELDS, "invalid document")
    d = document
    _require(d["schemaVersion"] == 1 and d["kind"] == "M2_PRIVATE_RPL_HISTORY_SOURCE_ONLY"
             and d["researchRole"] == "development_source_only"
             and d["source"] == "OpenFoot Starter", "invalid source contract")
    _require(isinstance(d["codeSha"], str) and
             re.fullmatch(r"[a-f0-9]{40}", d["codeSha"]) is not None,
             "invalid code SHA")
    _require(type(d["runId"]) is int and d["runId"] > 0, "invalid runner ID")
    observed = _timestamp(d["observedAtUtc"])
    _require(type(d["seasons"]) is list and len(d["seasons"]) == 7, "invalid season count")
    normalized = []
    for expected, season in zip(SEASONS, d["seasons"], strict=True):
        _require(type(season) is dict and set(season) == SEASON_FIELDS
                 and season["season"] == expected, "invalid development-only season")
        _require(all(isinstance(season[k], str) and HEX.fullmatch(season[k])
                     for k in ("sourceResponsesSha256", "normalizedRowsSha256")),
                 "invalid source hash")
        fixtures = season["fixtures"]
        _require(type(fixtures) is list and len(fixtures) == 240, "incomplete season")
        _require(_hash_fixture_rows(fixtures) == season["normalizedRowsSha256"],
                 "normalized fixture digest mismatch")
        seen_id = set()
        pairs = set()
        home_count: Counter[str] = Counter()
        away_count: Counter[str] = Counter()
        normalized_rows = []
        start_year = int(expected[:4])
        season_start = datetime(start_year, 7, 1, tzinfo=UTC)
        season_end = datetime(2020, 8, 1, tzinfo=UTC) if expected == "2019/20" else (
            datetime(start_year + 1, 7, 1, tzinfo=UTC)
        )
        for row in fixtures:
            _require(type(row) is dict and set(row) == ROW_FIELDS, "invalid match fields")
            _require(all(isinstance(row[k], str) and ID.fullmatch(row[k])
                         for k in ("sourceMatchId", "homeTeamId", "awayTeamId")),
                     "invalid match IDs")
            mid, home, away = row["sourceMatchId"], row["homeTeamId"], row["awayTeamId"]
            _require(mid not in seen_id and home != away and (home, away) not in pairs,
                     "duplicate or same-club fixture")
            _require(all(type(row[k]) is int and 0 <= row[k] <= 20
                         for k in ("homeGoals", "awayGoals")), "invalid final score")
            kickoff = _timestamp(row["kickoffAt"])
            _require(season_start <= kickoff < season_end and kickoff < observed,
                     "invalid season chronology")
            seen_id.add(mid)
            pairs.add((home, away))
            home_count[home] += 1
            away_count[away] += 1
            normalized_rows.append({
                "sourceMatchId": mid, "homeTeamId": home, "awayTeamId": away,
                "kickoffAt": kickoff, "homeGoals": row["homeGoals"], "awayGoals": row["awayGoals"],
            })
        clubs = set(home_count) | set(away_count)
        _require(len(clubs) == 16 and all(
            home_count[c] == 15 and away_count[c] == 15 for c in clubs
        ), "invalid club coverage")
        normalized.append(tuple(normalized_rows))
    return d, tuple(normalized)


def _verify_existing(cursor, snapshot_id, expected: tuple[dict, ...]) -> None:
    cursor.execute(_VERIFY_STORED, (snapshot_id,))
    stored = cursor.fetchall()
    if len(stored) != 240:
        raise DataError("M2 RPL private history: database stored row count mismatch")
    actual = {(r[0], r[1], r[2], r[3].astimezone(UTC),
               r[4], r[5]) for r in stored}
    reference = {(r["sourceMatchId"], r["homeTeamId"], r["awayTeamId"],
                  r["kickoffAt"], r["homeGoals"], r["awayGoals"]) for r in expected}
    if actual != reference:
        raise DataError("M2 RPL private history: private database row mismatch")


def persist_history(
    connection, document: dict, validated_rows: tuple[tuple[dict, ...], ...]
) -> dict:
    """All seven seasons inserted atomically, or no private rows changed."""
    inserted = 0
    with connection.cursor() as cursor:
        cursor.execute("set local statement_timeout = '30000ms'")
        cursor.execute("set local lock_timeout = '3000ms'")
        retrieved = _timestamp(document["observedAtUtc"])
        for s, rows in zip(document["seasons"], validated_rows, strict=True):
            cursor.execute(_INSERT_SNAPSHOT, (
                s["season"], s["sourceResponsesSha256"], s["normalizedRowsSha256"],
                retrieved, document["runId"],
            ))
            found = cursor.fetchone()
            if found is not None:
                snapshot = found[0]
                inserted += 1
                cursor.executemany(_INSERT_MATCH, [
                    (snapshot, r["sourceMatchId"], r["homeTeamId"], r["awayTeamId"],
                     r["kickoffAt"], r["homeGoals"], r["awayGoals"])
                    for r in rows
                ])
            else:
                cursor.execute(_FIND_SNAPSHOT, (s["season"], s["normalizedRowsSha256"]))
                existing = cursor.fetchone()
                _require(existing is not None, "conflicting immutable snapshot identity")
                snapshot = existing[0]
            _verify_existing(cursor, snapshot, rows)
        # All new deferred completeness triggers must succeed before committing.
        cursor.execute("set constraints ff_private.ff_rpl_history_snapshot_complete immediate")
    return {
        "schemaVersion": 1, "kind": "M2_PRIVATE_RPL_HISTORY_COMMIT",
        "source": "OpenFoot Starter", "sourceOnly": True,
        "storedSeasons": 7, "storedMatchesVerified": 1680,
        "insertedNewSnapshots": inserted, "existingSnapshotsVerified": 7 - inserted,
        "historicalPrematchVerified": False, "modelTrainingApproved": False,
        "holdoutRead": False, "publicRecordsWritten": 0,
    }


def _private_connection():
    host = os.environ.get("PGHOST", "")
    user = os.environ.get("PGUSER", "")
    _require(re.fullmatch(r"aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com", host) is not None
             and user == "postgres.upulkesaiwnwfagjgteh"
             and os.environ.get("PGDATABASE") == "postgres"
             and os.environ.get("PGSSLMODE") == "verify-full"
             and os.environ.get("PGPORT") == "5432"
             and os.environ.get("PGPASSWORD") and os.environ.get("PGSSLROOTCERT")
             and not any(os.environ.get(k) for k in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE")),
             "untrusted database tenant or connection routing")
    import psycopg

    return psycopg.connect(
        host=host, user=user, dbname="postgres",
        password=os.environ["PGPASSWORD"], port=5432,
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c statement_timeout=30000 -c idle_in_transaction_session_timeout=45000",
    )


def main() -> None:
    try:
        _require(len(sys.argv) == 2, "single protected input required")
        _require(os.environ.get("GITHUB_REPOSITORY") == "StanleyLl0yd/FootballForecast"
                 and os.environ.get("GITHUB_REF") == "refs/heads/main"
                 and os.environ.get("GITHUB_ACTOR") == "StanleyLl0yd"
                 and os.environ.get("FF_M2_PRIVATE_IMPORT_ENABLED") == "1",
                 "not an approved owner-only operation")
        path = Path(sys.argv[1])
        _require(path.is_file() and not path.is_symlink()
                 and 100000 <= path.stat().st_size <= 800000, "invalid bounded source file")
        document = json.loads(path.read_text(encoding="utf-8"))
        d, rows = validate_history_document(document)
        _require(d["codeSha"] == os.environ.get("GITHUB_SHA")
                 and str(d["runId"]) == os.environ.get("GITHUB_RUN_ID"),
                 "research code or runner identity mismatch")
        with _private_connection() as conn:
            receipt = persist_history(conn, d, rows)
        print(json.dumps(receipt, sort_keys=True, separators=(",", ":")))
    except Exception:
        print("FAIL: M2 private historical source import refused; no records or SQL exposed",
              file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
