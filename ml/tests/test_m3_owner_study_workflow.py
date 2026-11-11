"""Owner-only source-consumption scope and secret/logging guard regression."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/m3-owner-development-study.yml"
RUNNER = ROOT / "scripts/m3-owner-dev-study.py"


def test_workflow_requires_protected_exact_main_and_owner_confirmation():
    text = WORKFLOW.read_text(encoding="utf-8")
    for required in (
        "github.repository == 'StanleyLl0yd/FootballForecast'",
        "github.ref == 'refs/heads/main'",
        "github.actor == 'StanleyLl0yd'",
        "github.event.issue.number == 271",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m3-dev-aggregate-only'",
        "inputs.confirmation == 'M3_DEV_AGGREGATE_ONLY'",
        "environment: m1-source-import",
        "cancel-in-progress: false",
        "with: {persist-credentials: false}",
        '[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]]',
    ):
        assert required in text
    for banned in ("upload-artifact", "2025/26'", "set -x", "workflow_run:"):
        assert banned not in text


def test_runner_is_explicitly_read_only_and_suppresses_exception_details():
    text = RUNNER.read_text(encoding="utf-8")
    for required in (
        'sslmode="verify-full"',
        "default_transaction_read_only=on",
        "SET TRANSACTION READ ONLY",
        "audit_owner_study_aggregates(",
        'print(dumps(asdict(receipt)',
        'print("FAIL: bounded M3 owner study did not complete"',
        'GITHUB_REF") != "refs/heads/main"',
        'GITHUB_ACTOR") != "StanleyLl0yd"',
    ):
        assert required in text
    assert "print(aggregate_rows" not in text
    assert "print(sql" not in text
    assert "raise\n" not in text
