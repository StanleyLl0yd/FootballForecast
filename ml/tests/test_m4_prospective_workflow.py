"""M4-A5 owner-only prospective capture and DRY RUN cannot be a public API."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_write_is_separate_explicit_owner_only_dispatch():
    workflow = (ROOT / ".github/workflows/m4-owner-prospective-capture.yml"
                ).read_text(encoding="utf-8")
    runner = (ROOT / "scripts/m4-owner-prospective-capture.py"
              ).read_text(encoding="utf-8")
    for marker in (
        "github.repository == 'StanleyLl0yd/FootballForecast'",
        "github.ref == 'refs/heads/main'",
        "github.actor == 'StanleyLl0yd'",
        "github.actor_id == '131160519'",
        "github.triggering_actor == 'StanleyLl0yd'",
        "github.event.issue.number == 304",
        "github.event.comment.user.id == 131160519",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m4-private-capture-once'",
        "github.event.comment.body == '/m4-private-capture-dry-run'",
        "inputs.confirmation == 'M4_PRIVATE_CAPTURE_COMMIT'",
        "inputs.confirmation == 'M4_PRIVATE_CAPTURE_DRY_RUN'",
        "environment: m1-source-import",
        "permissions: {contents: read, id-token: write}",
        "cancel-in-progress: false",
        "persist-credentials: false",
        "M4_CAPTURE_GATED: $" + "{{",
        "OPENFOOT_API_KEY: $" + "{{ secrets.OPENFOOT_API_KEY }}",
        "PGHOST: $" + "{{ secrets.M1_PGHOST }}",
        "PGPASSWORD: $" + "{{ secrets.M1_PGPASSWORD }}",
        "M1_PGROOTCERT_B64: $" + "{{ secrets.M1_PGROOTCERT_B64 }}",
        "ssl", "M4_PRIVATE_CAPTURE_COMMIT",
    ):
        assert marker in workflow
    for forbidden in (
        "schedule:\n", "pull_request:\n", "git push", "curl -L",
        "NEXT_PUBLIC_", "service_role", "upload-artifact",
        "2025%2F26", "public.ff_forecasts",
    ):
        assert forbidden not in workflow
    assert "M4_PROSPECTIVE_MODE" in workflow
    assert '"GITHUB_ACTOR_ID"' in runner
    assert '"GITHUB_TRIGGERING_ACTOR"' in runner
    assert "PGSSLROOTCERT" in workflow
    assert "SERIALIZABLE" in runner
    assert "REPEATABLE READ READ ONLY" in runner
    assert "attest_future_source_digests" in runner
    assert "verify_live_matchtv_calendar" in runner
    assert "private_shadow_decision" in runner
    assert "conn.commit()" in runner
    assert "cursor.execute" in runner
    assert "M4_PRIVATE_PROSPECTIVE_REFUSED_AT=" in runner
    for forbidden in (
        "public.ff_forecasts", "2025/26'", "service_role",
        "print(proof.source_jwt)", "print(candidate.artifact_bytes)",
    ):
        assert forbidden not in runner


def test_existing_readonly_source_workflow_stays_separate_without_db_creds():
    old = (ROOT / ".github/workflows/m4-future-rpl-source-observation.yml"
           ).read_text(encoding="utf-8")
    assert "PGHOST" not in old
    assert "PGPASSWORD" not in old
    assert "M4_PRIVATE_CAPTURE_COMMIT" not in old
    assert "id-token: write" in old
    assert "/m4-future-rpl-source-readonly" in old


def test_new_private_escrow_has_no_anon_or_service_role_grants():
    migration = (ROOT / "database/migrations/0016_m4_private_signed_time_proofs.sql"
                 ).read_text(encoding="utf-8")
    for mark in (
        "ff_private.ff_m4_time_proofs",
        "force row level security",
        "revoke all",
        "public,anon,authenticated,service_role",
        "before update or delete",
        "before truncate",
        "clock_timestamp()",
        "source_oidc_jwt",
        "kickoff_oidc_jwt",
        "source_token_sha256",
        "team_mapping_sha256",
        "source_issued_at",
        "kickoff_issued_at",
    ):
        assert mark in migration
    ci = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    assert "database/migrations/0016_m4_private_signed_time_proofs.sql" in ci
    assert "database/tests/0027_m4_private_signed_time_proofs.sql" in ci


def test_rerun_by_non_owner_and_actor_id_mismatch_refused(monkeypatch):
    from runpy import run_path

    import pytest

    from football_forecast.data.contracts import DataError

    gate = run_path(str(ROOT / "scripts/m4-owner-prospective-capture.py"))["_gate"]
    env = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_ACTOR_ID": "131160519",
        "GITHUB_TRIGGERING_ACTOR": "StanleyLl0yd",
        "GITHUB_EVENT_NAME": "issue_comment",
        "GITHUB_RUN_ID": "90000000001",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": "a" * 40,
        "M4_CAPTURE_GATED": "false",
        "M4_PROSPECTIVE_MODE": "M4_PRIVATE_CAPTURE_DRY_RUN",
    }
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    assert gate() is False
    monkeypatch.setenv("GITHUB_TRIGGERING_ACTOR", "other_writer")
    with pytest.raises(DataError):
        gate()
    monkeypatch.setenv("GITHUB_TRIGGERING_ACTOR", "StanleyLl0yd")
    monkeypatch.setenv("GITHUB_ACTOR_ID", "42")
    with pytest.raises(DataError):
        gate()
