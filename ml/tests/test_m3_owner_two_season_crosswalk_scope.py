"""M3 owner-only two-season runner safety contract; no DB or web access."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/m3-owner-two-season-crosswalk.yml"
RUNNER = ROOT / "scripts/m3-owner-two-season-crosswalk.py"


def test_owner_workflow_enforces_security_boundary():
    text = WORKFLOW.read_text(encoding="utf-8")
    for expected in (
        "github.repository == 'StanleyLl0yd/FootballForecast'",
        "github.ref == 'refs/heads/main'",
        "github.actor == 'StanleyLl0yd'",
        "github.event.issue.number == 271",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m3-480-crosswalk-aggregate-only'",
        "inputs.confirmation == 'M3_480_CROSSWALK_AGGREGATE_ONLY'",
        "environment: m1-source-import",
        "cancel-in-progress: false",
        "with: {persist-credentials: false}",
    ):
        assert expected in text
    for forbidden in ("upload-artifact", "set -x", "workflow_run:"):
        assert forbidden not in text


def test_runner_cannot_read_holdout_or_print_raw_private_matches():
    text = RUNNER.read_text(encoding="utf-8")
    for expected in (
        '"https://www.rsssf.org/tablesr/rus2022.html"',
        '"https://www.rsssf.org/tablesr/rus2023.html"',
        "WHERE s.season IN ('2021/22','2022/23')",
        'sslmode="verify-full"',
        "default_transaction_read_only=on",
        "SET TRANSACTION READ ONLY",
        "audit_two_season_fixture_correspondence(",
        "M3_CORRELATION_SHA256=",
    ):
        assert expected in text
    for forbidden in (
        "print(private_rows", "print(public_rows", "print(raw",
        "print(QUERY", "raise\n", "INSERT ", "DELETE ", "UPDATE ",
        "'2025/26'", "'2026/27'",
    ):
        assert forbidden not in text
