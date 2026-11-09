"""Synthetic-only first private one-use research runner trust-boundary tests."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research import football_data_first_run as runner


def _owner_event(tmp_path, monkeypatch):
    event = {
        "comment": {
            "body": runner._COMMAND,
            "author_association": "OWNER",
            "user": {"id": 131160519, "login": "StanleyLl0yd"},
        },
        "issue": {"number": 182},
    }
    path = tmp_path / "github-event.json"
    path.write_text(json.dumps(event), encoding="utf-8")
    values = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_EVENT_NAME": "issue_comment",
        "GITHUB_SHA": "b" * 40,
        "GITHUB_RUN_ID": "1234567",
        "GITHUB_RUN_ATTEMPT": "1",
        "GITHUB_EVENT_PATH": str(path),
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    return path


def test_exact_owner_comment_event_and_replay_denials(tmp_path, monkeypatch):
    path = _owner_event(tmp_path, monkeypatch)
    assert runner.verified_event() == ("b" * 40, 1234567)
    for key, bad in (
        ("GITHUB_REPOSITORY", "OtherOwner/FootballForecast"),
        ("GITHUB_REF", "refs/heads/feature"),
        ("GITHUB_ACTOR", "attacker"),
        ("GITHUB_EVENT_NAME", "pull_request"),
        ("GITHUB_RUN_ATTEMPT", "2"),
        ("GITHUB_RUN_ID", "0"),
    ):
        monkeypatch.setenv(key, bad)
        with pytest.raises(DataError):
            runner.verified_event()
        _owner_event(tmp_path, monkeypatch)
    raw = json.loads(path.read_text())
    for changed in (
        {"comment": {**raw["comment"], "body": "/other"}},
        {"comment": {**raw["comment"], "author_association": "CONTRIBUTOR"}},
        {"comment": {**raw["comment"], "user": {
            "id": 555, "login": "StanleyLl0yd",
        }}},
        {"issue": {"number": 183}},
        {"issue": {"number": 182, "pull_request": {}}},
    ):
        event = dict(raw)
        event.update(changed)
        path.write_text(json.dumps(event), encoding="utf-8")
        with pytest.raises(DataError):
            runner.verified_event()
    path.write_text(json.dumps(raw), encoding="utf-8")


def test_protected_declared_method_is_immutable_candidate_not_source_read():
    sha = runner.checked_declaration()
    assert len(sha) == 64
    assert runner._STUDY_ID == "rpl-2025-26-football-data-fixed-poisson-v1"
    assert runner._SOURCE == "https://www.football-data.co.uk/new/RUS.csv"
    assert runner._NAME_POLICY_SHA and len(runner._NAME_POLICY_SHA) == 64


def test_accepted_head_redirect_does_not_fetch_source_body():
    from urllib.request import Request

    redirects = runner._BoundedRedirect()
    request = Request(runner._SOURCE, method="HEAD")
    routed = redirects.redirect_request(
        request, None, 301, "", {},
        "https://football-data.co.uk/new/RUS.csv",
    )
    assert routed.get_method() == "HEAD"
    assert routed.full_url == "https://football-data.co.uk/new/RUS.csv"


def test_rejected_external_source_redirects():
    redirects = runner._BoundedRedirect()
    for url in (
        "http://www.football-data.co.uk/new/RUS.csv",
        "https://attacker.example/new/RUS.csv",
        "https://www.football-data.co.uk/new/RUS.csv?poison=1",
        "https://www.football-data.co.uk/new/OTHER.csv",
        "https://www.football-data.co.uk:9999/new/RUS.csv",
    ):
        with pytest.raises(DataError):
            redirects.redirect_request(None, None, 301, "", {}, url)


def _fake_run(monkeypatch, *, fail_on_get=False):
    events = []
    raw = b"synthetic-csv-placeholder-" * 20

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def execute(self, query, args=None):
            name = ("MODEL" if query == runner._SQL_MODEL else
                    "CLAIM" if query == runner._SQL_CLAIM else
                    "RESULT" if query == runner._SQL_RESULT else "UNKNOWN")
            events.append((name, args))

        def fetchall(self):
            return [(
                b"synthetic-private-model", runner._FROZEN_MODEL_ARTIFACT,
                runner._FROZEN_MODEL_FITTED, "TRAIN_ONLY_UNAPPROVED",
                False, False,
            )]

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            events.append(("CLOSE", None))
            return False

        def cursor(self):
            return Cursor()

        def commit(self):
            events.append(("COMMIT", None))

    def fake_http(method):
        events.append((method, None))
        if method == "GET":
            if fail_on_get:
                raise DataError("synthetic post-reservation fetch failure")
            return raw
        assert method == "HEAD"
        return b""

    class Metrics:
        model_log_loss = 1.01
        model_brier = 0.62
        model_rps = 0.31
        training_prior_log_loss = 1.08
        training_prior_brier = 0.66
        training_prior_rps = 0.33

    class Result:
        metrics = Metrics()
        source_sha256 = "c" * 64
        cohort_sha256 = "d" * 64
        name_policy_sha256 = runner._NAME_POLICY_SHA
        model_top1_accuracy = 0.48
        training_prior_top1_accuracy = 0.41

        def as_dict(self):
            return {"syntheticMetricsPrivate": True, "metrics": 1.01}

    monkeypatch.setattr(runner, "checked_declaration", lambda: "e" * 64)
    monkeypatch.setattr(runner, "_private_connection", lambda: Connection())
    monkeypatch.setattr(runner, "_http", fake_http)
    monkeypatch.setattr(runner, "load_private_model", lambda *a, **kw: object())
    monkeypatch.setattr(
        runner, "parse_russian_2025_csv",
        lambda blob: SimpleNamespace(cohort_sha256="d" * 64),
    )
    monkeypatch.setattr(runner, "score_fixed_day_only", lambda **kw: Result())
    return events


def test_commit_immutable_claim_before_first_label_read(monkeypatch):
    events = _fake_run(monkeypatch)
    receipt = runner.run_once(code_sha="f" * 40, github_run_id=333333)
    order = [key for key, _value in events]
    assert order == [
        "HEAD", "MODEL", "CLAIM", "COMMIT", "GET",
        "RESULT", "COMMIT", "CLOSE",
    ]
    assert receipt["codeSha"] == "f" * 40
    assert receipt["eligibleMatches"] == 182
    assert receipt["abstentions"] == 58
    assert receipt["scoreMetricsPrivate"] is True
    assert receipt["oneUseReservationConsumed"] is True
    assert "model_log_loss" not in str(receipt)
    assert "1.01" not in str(receipt)
    assert "synthetic-private-model" not in str(receipt)
    assert events[2][1][4] == runner._NAME_POLICY_SHA


def test_failed_first_fetch_leaves_claim_consumed_without_retries(monkeypatch):
    events = _fake_run(monkeypatch, fail_on_get=True)
    with pytest.raises(DataError):
        runner.run_once(code_sha="f" * 40, github_run_id=333333)
    assert [key for key, _ in events] == [
        "HEAD", "MODEL", "CLAIM", "COMMIT", "GET", "CLOSE",
    ]


def test_workflow_is_exact_owner_only_no_automatic_or_public_aggregation():
    workflow = Path(
        ".github/workflows/m2-private-first-fixed-evaluation.yml"
    ).read_text(encoding="utf-8")
    script = Path("scripts/m2-private-first-fixed-eval-run.sh").read_text(
        encoding="utf-8"
    )
    for required in (
        "github.actor == 'StanleyLl0yd'",
        "github.ref == 'refs/heads/main'",
        "github.event.comment.user.id == 131160519",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m2-private-fixed-first-score-2025-26'",
        "environment: m1-source-import",
        "persist-credentials: false",
        "cancel-in-progress: false",
        "scripts/m2-private-first-fixed-eval-run.sh",
    ):
        assert required in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "upload-artifact" not in workflow
    assert "bash -n" in workflow
    assert "M2_PRIVATE_FIRST_SCORE_RECEIPT_SHA256" in script
    assert "M2_PRIVATE_FIRST_SCORE_RECEIPT_JSON" not in script
    assert "GITHUB_RUN_ATTEMPT" in script
    assert "PGSSLROOTCERT" in script
    assert "https://www.football-data.co.uk/new/RUS.csv" not in script


def test_sql_contract_only_private_one_use_claims_and_aggregate_results():
    migration = Path(
        "database/migrations/0014_m2_private_one_use_fixed_evaluation.sql"
    ).read_text(encoding="utf-8")
    for name in (
        "ff_private.ff_m2_one_use_study_claims",
        "ff_private.ff_m2_one_use_study_results",
    ):
        assert name in migration
    assert migration.count("force row level security") == 2
    assert migration.count("ff_private.ff_reject_ingest_mutation()") == 4
    assert "revoke all" in migration
    assert "2025/26 label" in migration
    assert "anon, authenticated, service_role" in migration
