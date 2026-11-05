"""Synthetic preflight tests only: no privileged network or heldout labels."""
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research import openfootball_roster_preflight as preflight
from football_forecast.research.locking import _digest
from football_forecast.research.openfootball_crosswalk import (
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
    prepare_official_roster_crosswalk,
)

SOURCE = preflight._PINNED_SOURCE_SHA
RETRIEVED = datetime(2026, 11, 1, 20, 56, 47, tzinfo=UTC)
SNAPSHOT = "00000000-1111-2222-3333-444444444444"
TRAIN = tuple(
    (f"synthetic:id:{n:02}", club)
    for n, club in enumerate(sorted(TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL))
)
ALIASES = tuple(sorted(
    _train_alias(name) for name in TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL.values()
))


def setup_synthetic_pins(monkeypatch):
    candidate = prepare_official_roster_crosswalk(
        train_source_pairs=TRAIN, model_team_aliases=ALIASES,
    )
    monkeypatch.setattr(preflight, "_PINNED_CROSSWALK_SHA", candidate.sha256)
    monkeypatch.setattr(
        preflight, "_PINNED_SNAPSHOT_SHA",
        _digest([SNAPSHOT, SOURCE, RETRIEVED.isoformat()]),
    )


def make_receipt(**kwargs):
    args = dict(
        train_pairs=TRAIN,
        model_escrow=dict(preflight._EXPECTED_ESCROW),
        snapshot_id=SNAPSHOT,
        snapshot_sha256=SOURCE,
        retrieved_at=RETRIEVED,
        code_sha="c" * 40,
    )
    args.update(kwargs)
    return preflight.build_preflight_receipt(**args)


def test_synthetic_protected_readonly_receipt_and_no_private_identifiers(monkeypatch):
    setup_synthetic_pins(monkeypatch)
    receipt = make_receipt()
    assert receipt == make_receipt()
    assert receipt["kind"] == "M2_PROTECTED_PREHOLDOUT_ROSTER_PREFLIGHT"
    assert receipt["trainOnlyClubCount"] == 16
    assert receipt["returningClubCount"] == 14
    assert receipt["unseenClubCount"] == 2
    assert receipt["expectedEligibleMatchesIfAllValid"] == 182
    assert receipt["expectedAbstentionsForUnseen"] == 58
    assert receipt["realPrivateTrainMetadataVerified"] is True
    for name in (
        "holdoutRead", "modelApproved", "immutableStudyLockApproved",
        "holdoutEvaluationPermitted", "externalHoldoutSourceRechecked",
    ):
        assert receipt[name] is False
    assert receipt["productionForecastsWritten"] == 0
    assert "synthetic:id" not in str(receipt)
    assert "2025/2026" not in str(receipt)

    doc = Path("docs/M2_OFFICIAL_2025_26_ROSTER_EVIDENCE.json")
    evidence = json.loads(doc.read_text(encoding="utf-8"))
    pending = evidence["preHoldoutMetadataCommitmentCandidate"]
    assert pending["candidateCrosswalkSha256"] == (
        "99ad249ceae34aa8fd12d77be8e4b58ad8b80ec87b169021b5ca962d176080b2"
    )
    assert pending["sealedSourceSnapshotIdentitySha256"] == (
        "afe82bbf33d6e547403ef1ce9505493a655661e0e0f78dffecaea9e857f5b191"
    )
    assert pending["sealedMatchRowsRead"] == 0
    assert pending["protectedMainExecutionReverified"] is False
    assert pending["immutableStudyLockApproved"] is False
    coverage = evidence["preregisteredEvaluationCoverage"]
    assert coverage["eligibleKnownVsKnownFixturesIfAllValid"] == 14 * 13
    assert coverage["expectedAbstentionsInvolvingUnseenClubIfAllValid"] == 240 - 182
    assert coverage["holdoutResultsRead"] is False


def test_bad_metadata_or_escrow_fails_closed(monkeypatch):
    setup_synthetic_pins(monkeypatch)
    for broken in (
        {"train_pairs": (*TRAIN[:-1], TRAIN[0])},
        {"snapshot_sha256": "f" * 64},
        {"snapshot_id": "other-snapshot"},
        {"retrieved_at": datetime(2026, 11, 1, 20, 56, 47)},
        {"retrieved_at": datetime(2026, 11, 1, 20, 56, 48, tzinfo=UTC)},
        {"code_sha": "invalid"},
        {"model_escrow": {
            **preflight._EXPECTED_ESCROW, "model_approved": True,
        }},
        {"model_escrow": {
            **preflight._EXPECTED_ESCROW, "fitted_model_sha256": "9" * 64,
        }},
    ):
        with pytest.raises(DataError):
            make_receipt(**broken)


def test_train_only_query_scope_and_protected_workflow_gate():
    assert "season='2024/2025'" in preflight._SQL_TRAIN
    assert preflight._SQL_TRAIN.count("dataset_role='train_baseline'") == 2
    for sql in (preflight._SQL_TRAIN, preflight._SQL_SNAPSHOT, preflight._SQL_ESCROW):
        assert "2025/2026" not in sql
        assert "home_goals" not in sql and "away_goals" not in sql
        assert "model_bytes" not in sql
        assert "INSERT " not in sql.upper()
        assert "UPDATE " not in sql.upper()
        assert "DELETE " not in sql.upper()
    workflow = Path(".github/workflows/m2-openfootball-train-only.yml").read_text(
        encoding="utf-8"
    )
    job = workflow.split("  calendar-roster-preflight:", maxsplit=1)[1]
    for expected in (
        "github.actor == 'StanleyLl0yd'",
        "github.ref == 'refs/heads/main'",
        "github.event.comment.user.login == 'StanleyLl0yd'",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m2-openfootball-roster-preflight'",
        "inputs.confirmation == 'OPENFOOTBALL_ROSTER_PREFLIGHT'",
        "environment: m1-source-import",
        "persist-credentials: false",
        "scripts/m2-openfootball-roster-preflight-run.sh",
    ):
        assert expected in job
    assert "schedule:" not in job
    assert "m2-openfootball-escrow-run.sh" not in job
    assert "upload-artifact" not in job


def test_fake_db_is_forced_read_only_and_never_selects_holdout(monkeypatch):
    setup_synthetic_pins(monkeypatch)
    executed = []
    data = [
        [(SNAPSHOT, SOURCE, RETRIEVED)],
        list(TRAIN),
        [tuple(preflight._EXPECTED_ESCROW.values())],
    ]

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, query, _params=None):
            executed.append(query)

        def fetchall(self):
            return data.pop(0)

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def cursor(self):
            return Cursor()

    monkeypatch.setattr(preflight, "_private_connection", Connection)
    receipt = preflight.run_read_only_preflight("c" * 40)
    assert receipt["realPrivateTrainMetadataVerified"] is True
    assert executed[0].strip().lower() == "set transaction read only"
    assert len(executed) == 6
    for sql in executed:
        assert "2025/2026" not in sql
        assert "home_goals" not in sql
        assert "away_goals" not in sql
