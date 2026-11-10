"""M3 owner-only 480-fixture runner scope tests (no DB or network)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/m3-owner-two-season-crosswalk.yml"
RUNNER = ROOT / "scripts/m3-owner-two-season-crosswalk.py"
SQL = ROOT / "research/sql/m3_480_owner_correspondence.sql"


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


def test_runner_cannot_read_holdout_or_fetch_raw_private_records():
    runner = RUNNER.read_text(encoding="utf-8")
    sql = SQL.read_text(encoding="utf-8")
    for expected in (
        '"https://www.rsssf.org/tablesr/rus2022.html"',
        '"https://www.rsssf.org/tablesr/rus2023.html"',
        'sslmode="verify-full"',
        "default_transaction_read_only=on",
        "SET TRANSACTION READ ONLY",
        "m3_480_owner_correspondence.sql",
        "M3_CORRELATION_SHA256=",
    ):
        assert expected in runner
    for forbidden in (
        "print(private_rows", "print(public_rows", "print(raw",
        "print(QUERY", "raise\n", "INSERT ", "DELETE ", "UPDATE ",
        "PrivateFixture(", "audit_two_season_fixture_correspondence(",
        "'2025/26'", "'2026/27'",
    ):
        assert forbidden not in runner
    assert "cur.execute(sql, (dumps(public_input" in runner
    assert "SELECT s.season,m.kickoff_at" not in runner
    assert "jsonb_to_recordset(%s::jsonb)" in sql
    assert "WHERE s.season IN ('2021/22','2022/23')" in sql
    assert "WHERE v.ok ORDER BY s.season" in sql
    assert sql.count("%s") == 1
    assert sql.count(";") == 1
    assert "2025/26" not in sql and "2026/27" not in sql
    assert set(__import__("re").findall(r"ff_private\.([a-z_]+)", sql)) == {
        "ff_rpl_history_matches", "ff_rpl_history_snapshots",
    }
    assert "s.home_id=h.private_id" not in sql  # no such join alias
    assert "m.home_id=h.private_id" in sql
    assert "m.away_id=a.private_id" in sql
    assert "public_hg=private_hg" in sql  # scores checked after graph mapping
