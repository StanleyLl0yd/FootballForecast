"""Synthetic-only tests for private, append-only CC0 model escrow."""
from hashlib import sha256

import pytest
from test_openfootball_training import fixture_doc

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import PROTOCOL
from football_forecast.research.model_escrow import load_private_model
from football_forecast.research.openfootball_escrow import (
    persist_private_training_escrow,
    prepare_private_training_escrow,
)
from test_openfootball_training import fixture_doc

CODE = "b" * 40


def sample():
    return prepare_private_training_escrow(fixture_doc(), code_sha=CODE, github_run_id=123456789)


def test_fitted_private_bytes_match_existing_train_only_fingerprint_and_never_public():
    receipt, secret = sample()
    assert receipt["kind"] == "M2_OPENFOOTBALL_PRIVATE_TRAIN_ONLY_ESCROW"
    assert receipt["protocol"] == PROTOCOL
    assert receipt["modelArtifactSha256"] == sha256(secret).hexdigest()
    assert receipt["trainingMatches"] == 240 and receipt["trainingClubs"] == 16
    assert receipt["researchState"] == "TRAIN_ONLY_UNAPPROVED"
    assert receipt["holdoutRead"] is False and receipt["modelApproved"] is False
    assert receipt["footbolnoRequired"] is False
    assert "S_" in secret.decode()
    assert "S_" not in str(receipt) and "OF_" not in str(receipt)
    model = load_private_model(
        secret, artifact_sha256=receipt["modelArtifactSha256"],
        fitted_model_sha256=receipt["fittedModelSha256"], expected_protocol=PROTOCOL,
    )
    assert len(model.teams) == 16 and model.training_matches == 240


class FakeCursor:
    def __init__(self, receipt, data, *, inserted=True, corrupt=False):
        self.receipt, self.data, self.queries = receipt, data, []
        self.inserted, self.corrupt = inserted, corrupt
        self.rowcount = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, query, params=None):
        self.queries.append((query.lower(), params))
        self.rowcount = int(self.inserted) if "insert into" in query.lower() else 0

    def fetchone(self):
        r = self.receipt
        actual = sha256(self.data).hexdigest()
        return (r["modelArtifactSha256"], "0" * 64 if self.corrupt else actual,
                len(self.data), r["codeSha"], r["githubRunId"],
                "TRAIN_ONLY_UNAPPROVED", False, False)


class FakeConnection:
    def __init__(self, cursor):
        self.one_cursor = cursor

    def cursor(self):
        return self.one_cursor


def test_only_private_table_write_then_verify_without_any_holdout_sql():
    receipt, payload = sample()
    cursor = FakeCursor(receipt, payload)
    result = persist_private_training_escrow(FakeConnection(cursor), receipt, payload)
    assert result["privateModelStored"] is True
    assert result["databaseDigestVerified"] is True
    assert result["insertedByThisRun"] is True
    assert result["immutableStudyLockApproved"] is False
    assert result["holdoutEvaluationPermitted"] is False
    statement_text = "\n".join(query for query, _ in cursor.queries)
    assert "ff_private.ff_m2_training_model_escrow" in statement_text
    for forbidden in (
        "ff_ingest_matches", "ff_ingest_snapshots", "sealed_holdout",
        "ff_forecasts", "2025/2026", "ff_source_records",
    ):
        assert forbidden not in statement_text
    assert payload in [arg for _, params in cursor.queries if params for arg in params]
    assert "S_" not in str(result)


def test_retry_exact_bytes_verifies_existing_protected_run_without_overwrite():
    receipt, payload = sample()
    cursor = FakeCursor(receipt, payload, inserted=False)
    result = persist_private_training_escrow(FakeConnection(cursor), receipt, payload)
    assert result["privateModelStored"] is True
    assert result["insertedByThisRun"] is False
    assert result["storedRunId"] == receipt["githubRunId"]


def test_tampering_is_denied_before_any_database_command():
    receipt, payload = sample()
    invalid = bytearray(payload)
    invalid[0] ^= 1
    cursor = FakeCursor(receipt, payload)
    with pytest.raises(DataError, match="untrusted source or model identity"):
        persist_private_training_escrow(FakeConnection(cursor), receipt, bytes(invalid))
    assert cursor.queries == []
    corrupted = FakeCursor(receipt, payload, corrupt=True)
    with pytest.raises(DataError, match="database write verification"):
        persist_private_training_escrow(FakeConnection(corrupted), receipt, payload)


@pytest.mark.parametrize("run", [0, -1, 3.4, "123", None, True])
def test_invalid_run_identity_denied_without_db_access(run):
    with pytest.raises(DataError, match="run ID"):
        prepare_private_training_escrow(fixture_doc(), code_sha=CODE, github_run_id=run)
