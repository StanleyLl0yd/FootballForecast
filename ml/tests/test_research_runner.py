"""Synthetic-only private M2 runner preparation; never requires DB credentials."""
import pytest
from test_research_lock import COMMIT, SHA, SNAPSHOT, SyntheticCursor, report, rows

from football_forecast.data.contracts import DataError
from football_forecast.research.runner import training_only_mapping


def test_training_only_club_mapping_is_stable_and_not_label_dependent():
    dataset = rows()
    teams = {t for row in dataset for t in (row[4], row[5])}
    mapping = training_only_mapping(teams)
    assert len(mapping) == 16 and len(set(mapping.values())) == 16
    assert mapping == training_only_mapping(set(reversed(sorted(teams))))
    assert all(len(label) == 22 and label.startswith("S_") for label in mapping.values())
    assert not any(value in teams for value in mapping.values())
    assert mapping["src-00"] != mapping["src-01"]


@pytest.mark.parametrize("clubs", [
    set(),
    {"src-00"},
    {"src-00"} | {f"src-{i:02}" for i in range(1, 15)},
    {f"src-{i:02}" for i in range(15)} | {""},
    {f"src-{i:02}" for i in range(15)} | {"x" * 101},
])
def test_reject_bad_mapping_source_cohorts(clubs):
    with pytest.raises(DataError):
        training_only_mapping(clubs)


def test_runner_is_importable_without_database_driver_or_credentials():
    from football_forecast.research import runner
    assert runner.main is not None

class PrivateCursor:
    def __init__(self, training_rows):
        self.training_rows = training_rows
        self.statements = []
        self.pending = ""

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, statement, parameters=None):
        self.statements.append((statement, parameters))
        self.pending = statement

    def fetchmany(self, size):
        if size == 2:
            return [("a0000000-0000-0000-0000-000000000001",)]
        if size == 241:
            return self.training_rows
        raise AssertionError("unexpected private read")


class PrivateConnection:
    def __init__(self, cursor):
        self.private_cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def cursor(self):
        return self.private_cursor


def test_stored_snapshot_preflight_reads_only_verified_train_without_source_download(monkeypatch):
    from football_forecast.research import runner
    cursor = PrivateCursor(rows())
    monkeypatch.setattr(runner, "_private_connection", lambda: PrivateConnection(cursor))
    result = runner.produce_private_preflight(
        source_sha256="a" * 64, code_sha="b" * 40,
    )
    assert result["kind"] == "M2_STORED_TRAIN_PREFLIGHT"
    assert result["trainingMatches"] == 240
    assert result["trainingClubs"] == 16
    assert result["storedTrainOnly"] is True
    assert result["externalSourceRechecked"] is False
    assert result["modelFitted"] is False
    assert result["holdoutRead"] is False
    assert result["historicalPrematchVerified"] is False
    assert len(result["snapshotIdentitySha256"]) == 64
    assert len(cursor.statements) == 3
    assert "repeatable read read only" in cursor.statements[0][0]
    assert "ff_ingest_snapshots" in cursor.statements[1][0]
    assert "ff_m2_training_rows" in cursor.statements[2][0]
    assert all(not any(word in sql.lower() for word in (
        "insert into", "update ", "delete from", "ff_m2_holdout_rows"
    )) for sql, _ in cursor.statements)
    assert "synthetic" not in str(result)
    assert "src-" not in str(result)


def test_stored_snapshot_preflight_refuses_bad_hash_and_nontraining_row_before_output(monkeypatch):
    from football_forecast.research import runner
    cursor = PrivateCursor(rows())
    monkeypatch.setattr(runner, "_private_connection", lambda: PrivateConnection(cursor))
    with pytest.raises(DataError):
        runner.produce_private_preflight(source_sha256="broken", code_sha="b"*40)
    assert cursor.statements == []
    bad_rows = rows()
    first = list(bad_rows[0])
    first[2] = "sealed_holdout"
    bad_rows[0] = tuple(first)
    monkeypatch.setattr(runner, "_private_connection", lambda: PrivateConnection(
        PrivateCursor(bad_rows)
    ))
    with pytest.raises(DataError, match="non-training"):
        runner.produce_private_preflight(source_sha256="a"*64, code_sha="b"*40)



def test_stored_snapshot_candidate_is_deterministic_and_matches_future_corroborated_lock(monkeypatch):
    from football_forecast.research import runner
    from football_forecast.research.locking import prepare_pre_holdout_lock
    def private_read():
        return PrivateConnection(PrivateCursor(rows()))
    monkeypatch.setattr(runner, "_private_connection", private_read)
    candidate = runner.produce_private_candidate(source_sha256=SHA, code_sha=COMMIT)
    assert candidate == runner.produce_private_candidate(source_sha256=SHA, code_sha=COMMIT)
    teams = {t for row in rows() for t in (row[4], row[5])}
    future_lock = prepare_pre_holdout_lock(
        SyntheticCursor(rows()), snapshot_id=SNAPSHOT, source_sha256=SHA,
        code_sha=COMMIT, club_mapping=runner.training_only_mapping(teams),
        corroboration=report(),
    )
    assert candidate["snapshotIdentitySha256"] == future_lock.snapshot_identity_sha256
    assert candidate["trainRowsSha256"] == future_lock.train_rows_sha256
    assert candidate["clubMappingSha256"] == future_lock.club_mapping_sha256
    assert candidate["fittedModelSha256"] == future_lock.fitted_model_sha256
    assert candidate["modelFitted"] is True
    assert candidate["preHoldoutLockApproved"] is False
    assert candidate["externalSourceRechecked"] is False
    assert candidate["holdoutRead"] is False
    assert candidate["modelAccuracyEvaluated"] is False
    assert "src-" not in str(candidate) and "synthetic-" not in str(candidate)


def test_stored_candidate_rejects_holdout_role_and_invalid_identity_without_fitting(monkeypatch):
    from football_forecast.research import runner
    private = PrivateCursor(rows())
    monkeypatch.setattr(runner, "_private_connection", lambda: PrivateConnection(private))
    with pytest.raises(DataError):
        runner.produce_private_candidate(source_sha256="x", code_sha=COMMIT)
    assert private.statements == []
    invalid = rows()
    first = list(invalid[0])
    first[2] = "sealed_holdout"
    invalid[0] = tuple(first)
    monkeypatch.setattr(runner, "_private_connection",
                        lambda: PrivateConnection(PrivateCursor(invalid)))
    with pytest.raises(DataError, match="non-training"):
        runner.produce_private_candidate(source_sha256=SHA, code_sha=COMMIT)
