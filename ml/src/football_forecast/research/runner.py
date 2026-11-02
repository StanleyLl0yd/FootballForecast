"""Protected manual train-only M2 research runner. Never queries the sealed holdout.

This module has no import-time database or network activity. The workflow obtains
the comparator from a pinned source and enforces an exact CSV byte hash first.
"""
import json
import os
import sys
from dataclasses import replace
from hashlib import sha256
from pathlib import Path
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.training_input import read_training_input
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.locking import (
    _check_corroboration,
    _digest,
    _model_fingerprint,
    _training_rows_fingerprint,
    prepare_pre_holdout_lock,
)

_SOURCE_URL = "https://footbolno.ru/data/league/235-matches.csv"
_LICENSE_URL = "https://footbolno.ru/otkrytye-dannye"


def training_only_mapping(source_team_ids: set[str]) -> dict[str, str]:
    """Stable source-ID-only aliases, never inferred from results or holdout."""
    if (len(source_team_ids) != 16 or any(not isinstance(t, str)
            or not t.strip() or len(t) > 100 for t in source_team_ids)):
        raise DataError("M2 runner: invalid training club identities")
    mapping = {
        t: "S_" + sha256(("footbolno-club:" + t).encode("utf-8")).hexdigest()[:20].upper()
        for t in source_team_ids
    }
    if len(set(mapping.values())) != 16:
        raise DataError("M2 runner: club alias hash collision")
    return mapping


def _read_comparator(path: Path) -> object:
    raw = path.read_bytes()
    if not 0 < len(raw) <= 20_000:
        raise DataError("M2 runner: source proof size invalid")
    return json.loads(raw.decode("utf-8"))


def _check_identity(source_sha256: str, code_sha: str) -> None:
    if (not isinstance(source_sha256, str)
            or not fullmatch(r"[a-f0-9]{64}", source_sha256)
            or not isinstance(code_sha, str)
            or not fullmatch(r"[a-f0-9]{40}", code_sha)):
        raise DataError("M2 runner: invalid pinned code/source identity")


def _private_connection():
    if not all(os.environ.get(name) for name in (
        "PGHOST", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGSSLROOTCERT"
    )):
        raise DataError("M2 runner: missing protected database credential")
    import psycopg

    return psycopg.connect(
        host=os.environ["PGHOST"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        port=5432,
        sslmode="verify-full",
        sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000",
    )


def _approved_training_snapshot(cursor, source_sha256: str):
    cursor.execute(
        "select s.id::text from ff_private.ff_ingest_snapshots s "
        "join public.ff_sources src on src.id=s.source_id "
        "where s.source_sha256=%s and s.source_url=%s and s.license_url=%s "
        "and src.name='Footbolno' and src.license_status='approved' "
        "and src.license_reference=s.license_url limit 2",
        (source_sha256, _SOURCE_URL, _LICENSE_URL),
    )
    rows = cursor.fetchmany(2)
    if len(rows) != 1:
        raise DataError("M2 runner: exact approved source snapshot not unique")
    snapshot_id = rows[0][0]
    return read_training_input(
        cursor, snapshot_id=snapshot_id, source_sha256=source_sha256
    )


def produce_private_preflight(*, source_sha256: str, code_sha: str) -> dict:
    """Inventory the already stored training snapshot; never fit or fetch sources."""
    _check_identity(source_sha256, code_sha)
    with _private_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("set transaction isolation level repeatable read read only")
            training = _approved_training_snapshot(cursor, source_sha256)
    clubs = {team for fixture in training.fixtures
             for team in (fixture.home_team_id, fixture.away_team_id)}
    return {
        "schemaVersion": 1,
        "kind": "M2_STORED_TRAIN_PREFLIGHT",
        "codeSha": code_sha,
        "sourceSha256": source_sha256,
        "snapshotIdentitySha256": _digest([
            training.snapshot_id, source_sha256, training.retrieved_at.isoformat()
        ]),
        "trainingMatches": len(training.fixtures),
        "trainingClubs": len(clubs),
        "storedTrainOnly": True,
        "externalSourceRechecked": False,
        "modelFitted": False,
        "holdoutRead": False,
        "historicalPrematchVerified": False,
    }



def produce_private_candidate(*, source_sha256: str, code_sha: str) -> dict:
    """Fit an ephemeral training-only research candidate, never an approved lock."""
    _check_identity(source_sha256, code_sha)
    with _private_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("set transaction isolation level repeatable read read only")
            training = _approved_training_snapshot(cursor, source_sha256)
    source_clubs = {club for row in training.fixtures
                    for club in (row.home_team_id, row.away_team_id)}
    club_mapping = training_only_mapping(source_clubs)
    mapped = tuple(replace(
        row, home_team_id=club_mapping[row.home_team_id],
        away_team_id=club_mapping[row.away_team_id],
    ) for row in training.fixtures)
    model = fit_independent_poisson(mapped)
    if model.training_matches != 240 or len(model.teams) != 16:
        raise DataError("M2 candidate: incomplete training fit")
    return {
        "schemaVersion": 1,
        "kind": "M2_STORED_TRAIN_CANDIDATE",
        "codeSha": code_sha,
        "sourceSha256": source_sha256,
        "snapshotIdentitySha256": _digest([
            training.snapshot_id, source_sha256, training.retrieved_at.isoformat()
        ]),
        "trainRowsSha256": _training_rows_fingerprint(training.fixtures),
        "clubMappingSha256": _digest(sorted(club_mapping.items())),
        "fittedModelSha256": _model_fingerprint(model),
        "trainingMatches": model.training_matches,
        "trainingClubs": len(model.teams),
        "storedTrainOnly": True,
        "externalSourceRechecked": False,
        "modelFitted": True,
        "preHoldoutLockApproved": False,
        "holdoutRead": False,
        "historicalPrematchVerified": False,
        "modelAccuracyEvaluated": False,
    }


def produce_lock(*, report_path: Path, source_sha256: str, code_sha: str) -> dict:
    """One read-only snapshot transaction, two train-only reads, no DML."""
    _check_identity(source_sha256, code_sha)
    report = _read_comparator(report_path)
    _check_corroboration(report, source_sha256)
    with _private_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("set transaction isolation level repeatable read read only")
            training = _approved_training_snapshot(cursor, source_sha256)
            source_teams = {
                team for fixture in training.fixtures
                for team in (fixture.home_team_id, fixture.away_team_id)
            }
            lock = prepare_pre_holdout_lock(
                cursor, snapshot_id=training.snapshot_id, source_sha256=source_sha256,
                code_sha=code_sha,
                club_mapping=training_only_mapping(source_teams),
                corroboration=report,
            )
    return lock.as_dict()


def main() -> int:
    if len(sys.argv) != 2:
        print("FAIL: M2 runner requires one bounded operation", file=sys.stderr)
        return 2
    try:
        identities = {
            "source_sha256": os.environ.get("M2_SOURCE_SHA", ""),
            "code_sha": os.environ.get("GITHUB_SHA", ""),
        }
        if sys.argv[1] == "--preflight":
            result = produce_private_preflight(**identities)
        elif sys.argv[1] == "--candidate":
            result = produce_private_candidate(**identities)
        else:
            result = produce_lock(report_path=Path(sys.argv[1]), **identities)
        print(json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False))
        return 0
    except Exception:
        # Never emit SQL errors, raw rows, source IDs, secrets or filenames.
        print("FAIL: protected M2 train-only operation refused; no holdout access", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
