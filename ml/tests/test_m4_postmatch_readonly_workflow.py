"""Synthetic-only M4-A6 owner read-only workflow authorization/side-effect tests."""
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from football_forecast.data.contracts import DataError

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/m4-owner-postmatch-observe.py"
WORKFLOW = ROOT / ".github/workflows/m4-owner-postmatch-observe.yml"


def _load():
    spec = importlib.util.spec_from_file_location("m4_a6_readonly_probe", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _owner_env(monkeypatch):
    expected = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_ACTOR_ID": "131160519",
        "GITHUB_TRIGGERING_ACTOR": "StanleyLl0yd",
        "GITHUB_EVENT_NAME": "issue_comment",
        "GITHUB_RUN_ID": "44512345678",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_SHA": "a" * 40,
        "M4_RESULT_READONLY_GATE": "true",
        "M4_RESULT_READONLY_MODE": "M4_RESULT_READONLY",
        "OPENFOOT_API_KEY": "of_live_" + "synthetic-only-not-a-secret",
        "PGHOST": "localhost",
        "PGDATABASE": "synthetic-db",
        "PGUSER": "synthetic-owner",
        "PGPASSWORD": "fake-local-only",
        "PGSSLROOTCERT": "/tmp/synthetic-ca-path",
    }
    for k, v in expected.items():
        monkeypatch.setenv(k, v)
    return expected


def test_exact_owner_gate_accepts_only_readonly_context(monkeypatch):
    _owner_env(monkeypatch)
    assert _load()._gate().startswith("of_live_")


@pytest.mark.parametrize("key,value", [
    ("GITHUB_REPOSITORY", "attacker/other"),
    ("GITHUB_REF", "refs/heads/feature"),
    ("GITHUB_ACTOR", "other"),
    ("GITHUB_ACTOR_ID", "42"),
    ("GITHUB_TRIGGERING_ACTOR", "other"),
    ("GITHUB_EVENT_NAME", "pull_request"),
    ("GITHUB_RUN_ID", "not-a-number"),
    ("GITHUB_RUN_ATTEMPT", ""),
    ("GITHUB_SHA", "short"),
    ("M4_RESULT_READONLY_GATE", "false"),
    ("M4_RESULT_READONLY_MODE", "M4_RESULT_WRITE"),
    ("OPENFOOT_API_KEY", "wrong-key"),
    ("PGHOST", ""),
    ("PGPASSWORD", ""),
    ("PGSSLROOTCERT", ""),
])
def test_owner_gate_denies_ref_event_spoof_and_unavailable_creds(
    monkeypatch, key, value,
):
    _owner_env(monkeypatch)
    monkeypatch.setenv(key, value)
    with pytest.raises(DataError):
        _load()._gate()


def test_readonly_connection_enforces_verify_full_and_transaction_read_only(
    monkeypatch,
):
    _owner_env(monkeypatch)
    driver = MagicMock()
    monkeypatch.setitem(__import__("sys").modules, "psycopg", driver)
    _load()._connection()
    args = driver.connect.call_args.kwargs
    assert args["sslmode"] == "verify-full"
    assert args["sslrootcert"] == "/tmp/synthetic-ca-path"
    assert "default_transaction_read_only=on" in args["options"]
    assert args["connect_timeout"] == 10


def test_owner_private_workflow_has_fixed_permissions_environment_and_no_writes():
    script = SCRIPT.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "environment: m1-source-import" in workflow
    assert "permissions: {contents: read, id-token: write}" in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.event.issue.number == 304" in workflow
    assert "github.event.comment.body == '/m4-result-readonly'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.triggering_actor == 'StanleyLl0yd'" in workflow
    assert "M4_RESULT_READONLY_MODE: M4_RESULT_READONLY" in workflow
    assert "persist-credentials: false" in workflow
    assert "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa" in workflow
    assert "default_transaction_read_only=on" in script
    assert "REPEATABLE READ READ ONLY" in script
    assert "c.fixture_key like 'rpl-2026-27-r15-%'" in script
    assert "where c.competition='RPL' and c.season='2026/27'" in script
    assert "databaseWrite" in script
    assert "publisherAuthenticityAttested" in script
    assert "playedFinalAttested" in script
    assert "scoringAuthorized" in script
    assert "publicationAuthorized" in script
    assert "holdout2025_26Read" in script
    assert "psycopg.connect(" in script
    for forbidden in (
        "insert into", "update ff_private", "delete from",
        "alter table", "create table", "drop table",
        "public.ff_forecasts", "M4_PRIVATE_CAPTURE_COMMIT",
    ):
        assert forbidden.lower() not in script.lower()


def test_result_fetch_cannot_follow_external_redirect():
    source = SCRIPT.read_text()
    assert "HTTPRedirectHandler" in source
    assert "def redirect_request(" in source
    assert "HTTPSHandler(context=ssl.create_default_context())" in source
    assert '"https://openfootapi.com/v1/matches?"' in source
    assert "MATCHTV_URL" in source
    assert "MATCHTV_PATHS" not in source
    assert '"https://matchtv.ru" + matchtv_path' not in source
    assert "set(MATCHTV_MATCH_IDS)" in source
    assert "parse_matchtv_result_candidate(" in source
    assert "verify_unattested_postmatch_score_digests(" in source
    assert "verify_postmatch_digest_clock(" not in source
    assert "parse_openfoot_score_observation(" in source
    assert "parse_openfoot_result_candidate(" not in source
    assert "independent_played_final_attested" in source
