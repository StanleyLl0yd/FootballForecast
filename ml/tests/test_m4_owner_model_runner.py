"""Static scope and private output tests for protected M4 candidate workflow."""
from pathlib import Path
from runpy import run_path

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
    assert "candidate.artifact_bytes" not in text
    assert "print(dumps(receipt" in text
    assert "'artifactPersisted': False" not in text  # JSON keys use double quotes
    assert '"artifactPersisted": False' in text
    assert '"modelApproved": False' in text
    assert '"holdoutRead": False' in text
    assert '"publicForecastsWritten": False' in text
