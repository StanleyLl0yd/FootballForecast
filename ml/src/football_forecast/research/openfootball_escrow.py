"""Protected private, persistent OpenFootball training-only model escrow.

Never loads 2025/26, uses Footbolno, or authorizes live forecasts. The only
database table referenced is the append-only ff_private M2 model escrow.
"""
import json
import os
import sys
from hashlib import sha256
from pathlib import Path
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import (
    PROTOCOL,
    REFERENCE_BLOB,
    REFERENCE_COMMIT,
    read_openfootball_calendar_training,
)
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.model_escrow import (
    load_private_model,
    serialize_private_model,
)
from football_forecast.research.openfootball_train import produce_openfootball_train_candidate

_SQL_INSERT = """
insert into ff_private.ff_m2_training_model_escrow (
  protocol, source_commit, source_blob_sha1, source_sha256, code_sha,
  train_rows_sha256, club_mapping_sha256, fitted_model_sha256,
  model_artifact_sha256, model_bytes, training_matches, training_clubs, github_run_id
) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
on conflict (protocol, code_sha, source_sha256, train_rows_sha256,
             club_mapping_sha256, fitted_model_sha256) do nothing
"""
_SQL_VERIFY = """
select model_artifact_sha256, encode(sha256(model_bytes), 'hex'),
       octet_length(model_bytes), code_sha, github_run_id,
       research_state, holdout_read, model_approved
from ff_private.ff_m2_training_model_escrow
where protocol=%s and code_sha=%s and source_sha256=%s
  and train_rows_sha256=%s and club_mapping_sha256=%s
  and fitted_model_sha256=%s
"""


def prepare_private_training_escrow(
    document: object, *, code_sha: str, github_run_id: int,
) -> tuple[dict, bytes]:
    """Refit the single frozen CC0 train cohort and self-verify private bytes."""
    if type(github_run_id) is not int or github_run_id <= 0:
        raise DataError("M2 private escrow: invalid protected run ID")
    receipt = produce_openfootball_train_candidate(document, code_sha=code_sha)
    fixtures, actual_sha = read_openfootball_calendar_training(document)
    if actual_sha != receipt["sourceBytesSha256"]:
        raise DataError("M2 private escrow: source digest drift")
    model = fit_independent_poisson(fixtures)
    private_bytes = serialize_private_model(model, protocol=PROTOCOL)
    artifact_sha = sha256(private_bytes).hexdigest()
    load_private_model(
        private_bytes,
        artifact_sha256=artifact_sha,
        fitted_model_sha256=receipt["fittedModelSha256"],
        expected_protocol=PROTOCOL,
    )
    if len(private_bytes) > 8192:
        raise DataError("M2 private escrow: invalid private byte budget")
    public_receipt = {
        "schemaVersion": 1,
        "kind": "M2_OPENFOOTBALL_PRIVATE_TRAIN_ONLY_ESCROW",
        "protocol": PROTOCOL,
        "sourceCommit": REFERENCE_COMMIT,
        "sourceGitBlobSha1": REFERENCE_BLOB,
        "sourceBytesSha256": actual_sha,
        "codeSha": code_sha,
        "trainRowsSha256": receipt["trainRowsSha256"],
        "clubMappingSha256": receipt["clubMappingSha256"],
        "fittedModelSha256": receipt["fittedModelSha256"],
        "modelArtifactSha256": artifact_sha,
        "trainingMatches": receipt["trainingMatches"],
        "trainingClubs": receipt["trainingClubs"],
        "githubRunId": github_run_id,
        "researchState": "TRAIN_ONLY_UNAPPROVED",
        "holdoutRead": False,
        "modelApproved": False,
        "productionForecastsWritten": 0,
        "footbolnoRequired": False,
    }
    return public_receipt, private_bytes


def persist_private_training_escrow(connection, receipt: dict, private_bytes: bytes) -> dict:
    """Use one privileged transaction; never query a source/holdout table."""
    actual = sha256(private_bytes).hexdigest()
    if (receipt["modelArtifactSha256"] != actual
            or receipt["protocol"] != PROTOCOL
            or receipt["researchState"] != "TRAIN_ONLY_UNAPPROVED"
            or receipt["holdoutRead"] is not False
            or receipt["modelApproved"] is not False):
        raise DataError("M2 private escrow: untrusted source or model identity")
    # Validate canonical content and the frozen fitted-model digest before any SQL.
    load_private_model(
        private_bytes, artifact_sha256=actual,
        fitted_model_sha256=receipt["fittedModelSha256"],
        expected_protocol=PROTOCOL,
    )
    with connection.cursor() as cursor:
        cursor.execute("set local statement_timeout = '12000ms'")
        cursor.execute("set local lock_timeout = '3000ms'")
        cursor.execute(_SQL_INSERT, (
            PROTOCOL, REFERENCE_COMMIT, REFERENCE_BLOB,
            receipt["sourceBytesSha256"], receipt["codeSha"],
            receipt["trainRowsSha256"], receipt["clubMappingSha256"],
            receipt["fittedModelSha256"], actual, private_bytes,
            240, 16, receipt["githubRunId"],
        ))
        inserted_now = cursor.rowcount == 1
        cursor.execute(_SQL_VERIFY, (
            PROTOCOL, receipt["codeSha"], receipt["sourceBytesSha256"],
            receipt["trainRowsSha256"], receipt["clubMappingSha256"],
            receipt["fittedModelSha256"],
        ))
        row = cursor.fetchone()
        if (row is None or len(row) != 8
                or row[0] != actual or row[1] != actual
                or row[2] != len(private_bytes) or row[3] != receipt["codeSha"]
                or type(row[4]) is not int or row[4] <= 0
                or row[5] != "TRAIN_ONLY_UNAPPROVED"
                or row[6] is not False or row[7] is not False):
            raise DataError("M2 private escrow: database write verification failed")
        return {
            **receipt,
            "storedRunId": row[4],
            "insertedByThisRun": inserted_now,
            "privateModelStored": True,
            "databaseDigestVerified": True,
            "immutableStudyLockApproved": False,
            "holdoutEvaluationPermitted": False,
        }


def _private_connection():
    if not all(os.environ.get(name) for name in (
        "PGHOST", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGSSLROOTCERT",
    )):
        raise DataError("M2 private escrow: missing protected database credentials")
    import psycopg

    return psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        dbname=os.environ["PGDATABASE"], password=os.environ["PGPASSWORD"],
        port=5432, sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c statement_timeout=12000 -c idle_in_transaction_session_timeout=30000",
    )


def main() -> None:
    """Train and privately store one fitted model; public output is aggregate only."""
    try:
        if len(sys.argv) != 2:
            raise DataError("M2 private escrow: expected one private source file")
        path = Path(sys.argv[1])
        if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= 100_000:
            raise DataError("M2 private escrow: invalid bounded input")
        code_sha = os.environ.get("GITHUB_SHA", "")
        run = os.environ.get("GITHUB_RUN_ID", "")
        if not fullmatch(r"[0-9]{1,18}", run):
            raise DataError("M2 private escrow: invalid run identity")
        document = json.loads(path.read_text(encoding="utf-8"))
        receipt, private_bytes = prepare_private_training_escrow(
            document, code_sha=code_sha, github_run_id=int(run),
        )
        with _private_connection() as connection:
            result = persist_private_training_escrow(connection, receipt, private_bytes)
        print(json.dumps(result, sort_keys=True, separators=(",", ":"), allow_nan=False))
    except Exception:
        print("FAIL: M2 private training-only escrow refused; no model bytes logged",
              file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
