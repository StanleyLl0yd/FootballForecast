"""Static scope and private output tests for protected M4 candidate workflow."""
from pathlib import Path
from runpy import run_path
from types import SimpleNamespace

import pytest

from football_forecast.data.contracts import DataError

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/m4-owner-model-candidate.yml"
RUNNER = ROOT / "scripts/m4-owner-model-candidate.py"


def test_owner_workflow_requires_protected_main_exact_owner_and_command():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "github.repository == 'StanleyLl0yd/FootballForecast'" in text
    assert "github.ref == 'refs/heads/main'" in text
    assert "github.actor == 'StanleyLl0yd'" in text
    assert "github.event.issue.number == 304" in text
    assert "github.event.comment.user.id == 131160519" in text
    assert "github.event.comment.author_association == 'OWNER'" in text
    assert "github.event.comment.body == '/m4-model-candidate-readonly'" in text
    assert "environment: m1-source-import" in text
    assert "persist-credentials: false" in text
    assert "group: m4-owner-private-candidate" in text
    assert "cancel-in-progress: false" in text
    assert "GITHUB_SHA" in text
    assert "sslmode" not in text or "verify-full" in text
    assert "sourceManifestSha256" in text
    assert "modelArtifactSha256" in text
    assert "artifactPersisted" in text
    assert "modelApproved" in text
    assert "publicForecastsWritten" in text


def test_owner_runner_hardcodes_seven_prior_seasons_and_select_only():
    data = run_path(str(RUNNER))
    expected = {
        "2018/19", "2019/20", "2020/21", "2021/22",
        "2022/23", "2023/24", "2024/25",
    }
    for name in ("SNAPSHOTS_SQL", "MATCHES_SQL"):
        sql = data[name]
        assert sql.strip().upper().startswith("SELECT ")
        assert "ff_private.ff_rpl_history_" in sql
        for season in expected:
            assert season in sql
        assert "2025/26" not in sql and "2026/27" not in sql
        assert " INSERT " not in sql.upper()
        assert " UPDATE " not in sql.upper()
        assert " DELETE " not in sql.upper()
        assert "CREATE " not in sql.upper()
    assert len(data["EXCLUSIONS"]) == 7
    assert "2025/26" not in {key[0] for key in data["EXCLUSIONS"]}
    text = RUNNER.read_text(encoding="utf-8")
    assert "READ ONLY" in text
    assert "sslmode=\"verify-full\"" in text
    assert "connection.rollback()" in text
    assert "candidate.artifact_bytes" in text  # private parameter only
    assert "print(candidate.artifact_bytes)" not in text
    assert "print(dumps(receipt" in text
    assert "'artifactPersisted': False" not in text  # JSON keys use double quotes
    assert '"artifactPersisted": persist' in text
    assert '"modelApproved": False' in text
    assert '"holdoutRead": False' in text
    assert '"publicForecastsWritten": False' in text


def _synthetic_candidate(data):
    return SimpleNamespace(
        model_version="m4-team-poisson-shrink12-shadow-v1",
        eligible_matches=1673,
        distinct_clubs=26,
        source_manifest_sha256="a" * 64,
        eligible_rows_sha256="b" * 64,
        artifact_sha256=data["FROZEN_M4_ARTIFACT_SHA256"],
        artifact_bytes=b"private-only-synthetic-artifact",
    )


class StubCursor:
    def __init__(self, candidate, inserted):
        self.candidate = candidate
        self.inserted = inserted
        self.statements = []
        self.row = None

    def execute(self, sql, params):
        self.statements.append((sql, params))
        if sql.strip().startswith("INSERT INTO"):
            self.row = ("uuid-synthetic",) if self.inserted else None
        else:
            c = self.candidate
            self.row = (c.source_manifest_sha256,c.eligible_rows_sha256,
                        c.artifact_sha256,c.model_version,c.eligible_matches,
                        c.distinct_clubs,False,False,False,
                        len(c.artifact_bytes),c.artifact_sha256)

    def fetchone(self):
        return self.row


@pytest.mark.parametrize("inserted", [True, False])
def test_private_escrow_only_exact_frozen_model_and_idempotent_hash(inserted):
    module = run_path(str(RUNNER))
    candidate = _synthetic_candidate(module)
    cursor = StubCursor(candidate, inserted)
    stored = module["persist_private_candidate"](
        cursor,candidate,run_id=992233445,code_sha="c" * 40
    )
    assert stored is inserted
    assert len(cursor.statements) == 2
    insert, values = cursor.statements[0]
    assert "ff_private.ff_m4_candidate_models" in insert
    assert "ON CONFLICT (model_sha256) DO NOTHING" in insert
    assert candidate.artifact_bytes in values
    assert candidate.artifact_sha256 in values
    assert "public.ff_forecasts" not in insert
    assert all("2025/26" not in sql for sql, _ in cursor.statements)


@pytest.mark.parametrize("failure", ["sha","run","code"])
def test_private_escrow_refuses_wrong_model_or_untrusted_run(failure):
    module = run_path(str(RUNNER))
    candidate = _synthetic_candidate(module)
    cursor = StubCursor(candidate, True)
    kwargs = {"run_id":992233445,"code_sha":"c" * 40}
    if failure == "sha":
        candidate.artifact_sha256 = "f" * 64
    elif failure == "run":
        kwargs["run_id"] = -1
    else:
        kwargs["code_sha"] = "bad"
    with pytest.raises(DataError):
        module["persist_private_candidate"](cursor,candidate,**kwargs)
    assert cursor.statements == []


def test_private_write_command_is_separately_gated_from_read_only():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "github.event.comment.body == '/m4-model-store-private'" in text
    assert "inputs.confirmation == 'M4_PRIVATE_MODEL_STORE'" in text
    assert "M4_STORE_GATED" in text
    assert "M4_PRIVATE_MODEL_STORE_EXPLICIT" in text
    assert "environment: m1-source-import" in text
    assert "github.event.comment.user.id == 131160519" in text
    assert "persist-credentials: false" in text
    assert "publicForecastsWritten" in text
    assert "M4_PRIVATE_MODEL_PERSISTED=" in text
