"""Private seven-season RPL source archive, never a model or holdout release.

Protected main/owner runner only. All source records stay in a private PG schema.
"""
import json
import os
import re
import sys
from collections import Counter
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

SEASONS = tuple(f"{y}/{(y+1)%100:02d}" for y in range(2018, 2025))
FIELDS = ("season", "source_match_id", "home_team_id", "away_team_id",
          "kickoff_at", "home_goals", "away_goals")
ROW_FIELDS = (*FIELDS, "normalized_row_sha256")
HASH = re.compile(r"[a-f0-9]{64}\Z")
ID = re.compile(r"[A-Za-z0-9_-]{2,160}\Z")
CODE = re.compile(r"[a-f0-9]{40}\Z")
ISO = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\Z")
KIND = "M2_OPENFOOT_PRIVATE_RPL_HISTORY_ARCHIVE"


class ArchiveError(ValueError):
    """An archival input is unverifiable. No source fields should enter logs."""


def canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"),
                      allow_nan=False).encode("utf-8")


def validate_archive(manifest: object, data: bytes) -> list[dict]:
    """Independently verify every canonical source row before any database access."""
    if type(manifest) is not dict or not isinstance(data, bytes) or not 1 <= len(data) <= 1_500_000:
        raise ArchiveError("invalid private data envelope")
    expected = {"schemaVersion", "kind", "sourceId", "sourceTermsUrl",
                "researchState", "codeSha", "githubRunId", "retrievedAtUtc",
                "sourceResponsesSha256", "normalizedSha256", "seasons", "matches",
                "developmentSeasons", "seasonSnapshots", "rightsState",
                "strictPrematchProvenanceVerified",
                "modelTrainingApproved", "holdoutRead", "publicRowsWritten"}
    if (set(manifest) != expected or manifest["schemaVersion"] != 1
            or manifest["kind"] != KIND or manifest["sourceId"] != "openfoot_starter"
            or manifest["sourceTermsUrl"] != "https://openfootapi.com/terms"
            or manifest["researchState"] != "SOURCE_ARCHIVE_ONLY_UNAPPROVED"
            or manifest["rightsState"] != "OWNER_PRIVATE_RESEARCH_UNRESOLVED"
            or type(manifest["codeSha"]) is not str or CODE.fullmatch(manifest["codeSha"]) is None
            or type(manifest["githubRunId"]) is not int or manifest["githubRunId"] < 1
            or type(manifest["retrievedAtUtc"]) is not str
            or ISO.fullmatch(manifest["retrievedAtUtc"]) is None
            or type(manifest["sourceResponsesSha256"]) is not str
            or HASH.fullmatch(manifest["sourceResponsesSha256"]) is None
            or type(manifest["normalizedSha256"]) is not str
            or HASH.fullmatch(manifest["normalizedSha256"]) is None
            or manifest["seasons"] != 7 or manifest["matches"] != 1680
            or manifest["developmentSeasons"] != list(SEASONS)
            or manifest["strictPrematchProvenanceVerified"] is not False
            or manifest["modelTrainingApproved"] is not False
            or manifest["holdoutRead"] is not False
            or manifest["publicRowsWritten"] != 0):
        raise ArchiveError("invalid private archive manifest")
    retrieved = datetime.fromisoformat(manifest["retrievedAtUtc"].replace("Z", "+00:00"))
    if retrieved.tzinfo is None or retrieved <= datetime(2026, 11, 3, tzinfo=UTC):
        raise ArchiveError("invalid historical archive retrieval time")
    if sha256(data).hexdigest() != manifest["normalizedSha256"] or not data.endswith(b"\n"):
        raise ArchiveError("private archive checksum mismatch")
    lines = data.splitlines()
    if len(lines) != 1680:
        raise ArchiveError("unexpected private history length")
    rows, ids, directed = [], set(), set()
    appearances, home_counts, away_counts = Counter(), Counter(), Counter()
    for line in lines:
        try:
            row = json.loads(line)
        except (ValueError, UnicodeDecodeError) as exc:
            raise ArchiveError("invalid private JSONL") from exc
        if type(row) is not dict or tuple(row) != ROW_FIELDS:
            raise ArchiveError("unexpected historical record fields")
        base = {key: row[key] for key in FIELDS}
        if (type(row["normalized_row_sha256"]) is not str
                or sha256(canonical_json(base)).hexdigest() != row["normalized_row_sha256"]):
            raise ArchiveError("private row digest mismatch")
        s = row["season"]
        if s not in SEASONS or any(
            type(row[field]) is not str or ID.fullmatch(row[field]) is None
            for field in ("source_match_id", "home_team_id", "away_team_id")
        ) or row["home_team_id"] == row["away_team_id"]:
            raise ArchiveError("invalid historical identity or season")
        if (type(row["kickoff_at"]) is not str
                or ISO.fullmatch(row["kickoff_at"]) is None):
            raise ArchiveError("invalid historical kickoff")
        kickoff = datetime.fromisoformat(row["kickoff_at"].replace("Z", "+00:00"))
        y = int(s[:4])
        end = (
            datetime(2020, 8, 1, tzinfo=UTC)
            if s == "2019/20" else datetime(y + 1, 7, 1, tzinfo=UTC)
        )
        if not datetime(y, 7, 1, tzinfo=UTC) <= kickoff < end or kickoff >= retrieved:
            raise ArchiveError("out-of-season or future history")
        if any(type(row[field]) is not int or not 0 <= row[field] <= 20
               for field in ("home_goals", "away_goals")):
            raise ArchiveError("invalid final football score")
        key = (s, row["source_match_id"])
        pair = (s, row["home_team_id"], row["away_team_id"])
        if key in ids or pair in directed:
            raise ArchiveError("duplicate historical match")
        ids.add(key)
        directed.add(pair)
        appearances[s, row["home_team_id"]] += 1
        appearances[s, row["away_team_id"]] += 1
        home_counts[s, row["home_team_id"]] += 1
        away_counts[s, row["away_team_id"]] += 1
        if canonical_json(row) != line:
            raise ArchiveError("noncanonical historical JSONL")
        rows.append(row)
    if rows != sorted(rows, key=lambda r: (r["season"], r["source_match_id"])):
        raise ArchiveError("unstable historical archive order")
    for s in SEASONS:
        if (sum(x[0] == s for x in ids) != 240
                or sum(x[0] == s for x in directed) != 240
                or sum(x[0] == s for x in home_counts) != 16
                or sum(x[0] == s for x in away_counts) != 16
                or any(n != 30 for (season, _), n in appearances.items() if season == s)
                or any(n != 15 for (season, _), n in home_counts.items() if season == s)
                or any(n != 15 for (season, _), n in away_counts.items() if season == s)):
            raise ArchiveError("incomplete directed RPL season")
    snapshots = manifest.get("seasonSnapshots")
    if type(snapshots) is not list or len(snapshots) != 7:
        raise ArchiveError("invalid season snapshot manifest")
    for i, s in enumerate(SEASONS):
        entry = snapshots[i]
        if (type(entry) is not dict or set(entry) != {
                "season", "rows", "sourceResponsesSha256", "normalizedRowsSha256"}
                or entry["season"] != s or entry["rows"] != 240
                or type(entry["sourceResponsesSha256"]) is not str
                or HASH.fullmatch(entry["sourceResponsesSha256"]) is None
                or type(entry["normalizedRowsSha256"]) is not str
                or HASH.fullmatch(entry["normalizedRowsSha256"]) is None):
            raise ArchiveError("invalid historical season snapshot")
        season_bytes = b"\n".join(canonical_json(r) for r in rows if r["season"] == s) + b"\n"
        if sha256(season_bytes).hexdigest() != entry["normalizedRowsSha256"]:
            raise ArchiveError("historical season snapshot checksum mismatch")
    return rows


_INSERT_BATCH = """
insert into ff_private.ff_rpl_history_snapshots (
 season, source_responses_sha256, normalized_rows_sha256, retrieved_at,
 github_run_id, source_response_pages, fixture_count
) values (%s,%s,%s,%s,%s,17,240)
returning id
"""
_INSERT_ROWS = """
insert into ff_private.ff_rpl_history_matches (
 snapshot_id, source_match_id, home_team_id, away_team_id,
 kickoff_at, home_goals, away_goals
)
select %s::uuid, r.source_match_id, r.home_team_id, r.away_team_id,
 r.kickoff_at::timestamptz, r.home_goals, r.away_goals
from jsonb_to_recordset(%s::jsonb) as r(
 season text, source_match_id text, home_team_id text, away_team_id text,
 kickoff_at text, home_goals int, away_goals int, normalized_row_sha256 text
)
"""
_SELECT_ROWS = """
select source_match_id, home_team_id, away_team_id,
 to_char(kickoff_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
 home_goals, away_goals
from ff_private.ff_rpl_history_matches
where snapshot_id=%s
order by source_match_id
"""


def store_archive(connection, manifest: dict, data: bytes) -> dict:
    """Commit up to seven immutable private 240-row snapshots atomically."""
    rows = validate_archive(manifest, data)
    created = 0
    stored_run_ids = []
    with connection.cursor() as cur:
        cur.execute("set local statement_timeout = '90000ms'")
        cur.execute("set local lock_timeout = '5000ms'")
        cur.execute("select pg_advisory_xact_lock(hashtext('ff-m2-private-rpl-history'))")
        cur.execute("select pg_database_size(current_database())")
        if cur.fetchone()[0] >= 268_435_456:
            raise ArchiveError("database free-budget guard")
        for entry in manifest["seasonSnapshots"]:
            season = entry["season"]
            cohort = [r for r in rows if r["season"] == season]
            if len(cohort) != 240:
                raise ArchiveError("incomplete private season")
            cur.execute("""
              select id,github_run_id,model_training_approved,holdout_read,
                     historical_prematch_verified
              from ff_private.ff_rpl_history_snapshots
              where season=%s and normalized_rows_sha256=%s
            """, (season, entry["normalizedRowsSha256"]))
            existing = cur.fetchone()
            if existing is None:
                cur.execute(_INSERT_BATCH, (
                    season, entry["sourceResponsesSha256"],
                    entry["normalizedRowsSha256"], manifest["retrievedAtUtc"],
                    manifest["githubRunId"],
                ))
                snapshot_id = cur.fetchone()[0]
                cur.execute(_INSERT_ROWS, (snapshot_id, json.dumps(cohort, separators=(",", ":"))))
                if cur.rowcount != 240:
                    raise ArchiveError("private season insertion count mismatch")
                stored_run_ids.append(manifest["githubRunId"])
                created += 1
            else:
                snapshot_id, old_run, training, holdout, historical = existing
                if training is not False or holdout is not False or historical is not False:
                    raise ArchiveError("private archive unexpectedly approved or held out")
                stored_run_ids.append(old_run)
            cur.execute(_SELECT_ROWS, (snapshot_id,))
            saved = cur.fetchall()
            if len(saved) != 240:
                raise ArchiveError("private season readback count mismatch")
            reconstructed = []
            for source_id, home, away, kickoff, hg, ag in saved:
                base = {
                    "season": season, "source_match_id": source_id,
                    "home_team_id": home, "away_team_id": away,
                    "kickoff_at": kickoff, "home_goals": hg, "away_goals": ag,
                }
                reconstructed.append({
                    **base,
                    "normalized_row_sha256": sha256(canonical_json(base)).hexdigest(),
                })
            actual = b"\n".join(map(canonical_json, reconstructed)) + b"\n"
            if (sha256(actual).hexdigest() != entry["normalizedRowsSha256"]
                    or reconstructed != cohort):
                raise ArchiveError("private historical season readback mismatch")
    return {
        "schemaVersion": 1, "kind": KIND,
        "sourceResponsesSha256": manifest["sourceResponsesSha256"],
        "normalizedSha256": manifest["normalizedSha256"],
        "codeSha": manifest["codeSha"], "githubRunId": manifest["githubRunId"],
        "storedRunId": manifest["githubRunId"] if created else stored_run_ids[0],
        "seasons": 7, "matches": len(rows),
        "privateArchiveStored": True, "insertedByThisRun": created > 0,
        "databaseReadbackVerified": True,
        "researchState": "SOURCE_ARCHIVE_ONLY_UNAPPROVED",
        "modelTrainingApproved": False, "holdoutRead": False,
        "productionForecastsWritten": 0,
    }


def private_connection():
    """Restrict the privileged connection to the pinned Frankfurt tenant and TLS CA."""
    import psycopg

    host = os.environ.get("PGHOST", "")
    user = os.environ.get("PGUSER", "")
    database = os.environ.get("PGDATABASE", "")
    password = os.environ.get("PGPASSWORD", "")
    cert = os.environ.get("PGSSLROOTCERT", "")
    port = os.environ.get("PGPORT", "5432")
    if (re.fullmatch(r"aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com", host) is None
            or user != "postgres.upulkesaiwnwfagjgteh" or database != "postgres"
            or not password or port != "5432" or not cert or not Path(cert).is_file()
            or os.environ.get("PGHOSTADDR") or os.environ.get("PGSERVICE")
            or os.environ.get("PGSERVICEFILE") or os.environ.get("PGOPTIONS")):
        raise ArchiveError("untrusted protected archive database target")
    return psycopg.connect(
        host=host, user=user, dbname=database, password=password, port=5432,
        sslmode="verify-full", sslrootcert=cert, connect_timeout=10,
        options="-c statement_timeout=90000 -c idle_in_transaction_session_timeout=120000",
    )


def read_private(path: str, max_size: int) -> bytes:
    p = Path(path)
    if p.is_symlink() or not p.is_file() or not 0 < p.stat().st_size <= max_size:
        raise ArchiveError("invalid private archival file")
    return p.read_bytes()


def main() -> None:
    try:
        if len(sys.argv) != 3:
            raise ArchiveError("expected private manifest and history JSONL")
        manifest = json.loads(read_private(sys.argv[1], 4096))
        data = read_private(sys.argv[2], 1_500_000)
        if (manifest.get("codeSha") != os.environ.get("GITHUB_SHA")
                or str(manifest.get("githubRunId")) != os.environ.get("GITHUB_RUN_ID")):
            raise ArchiveError("protected GitHub execution identity differs")
        with private_connection() as conn:
            result = store_archive(conn, manifest, data)
        print(json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False))
    except Exception:
        print("FAIL: M2 historical private store refused; no source rows logged", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
