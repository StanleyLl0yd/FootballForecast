"""Synthetic-only A6 owner club raw-digest workflow and safety boundary tests.

No real HTTP, DB, private fixture data, external tokens or 2025/26 access.
"""
import importlib.util
import sys
from datetime import UTC, datetime
from json import loads
from pathlib import Path
from unittest.mock import MagicMock
from urllib.error import HTTPError, URLError

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import CLUB_REPORTS

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/m4-owner-club-report-digests.py"
WORKFLOW = ROOT / ".github/workflows/m4-owner-club-report-digests.yml"


def _module():
    spec = importlib.util.spec_from_file_location("m4_a6_club_digests", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _owner(monkeypatch):
    env = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_ACTOR_ID": "131160519",
        "GITHUB_TRIGGERING_ACTOR": "StanleyLl0yd",
        "GITHUB_EVENT_NAME": "issue_comment",
        "GITHUB_SHA": "a" * 40,
        "GITHUB_RUN_ID": "45123456789",
        "GITHUB_RUN_ATTEMPT": "1",
        "M4_CLUB_READONLY_GATE": "true",
        "M4_CLUB_READONLY_MODE": "M4_CLUB_READONLY",
        "ACTIONS_ID_TOKEN_REQUEST_URL": (
            "https://token.actions.githubusercontent.com/test/oidc"
        ),
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN": "synthetic-test-value-only",
    }
    for key, val in env.items():
        monkeypatch.setenv(key, val)
    return env


def test_gate_accepts_only_exact_immutable_owner_context(monkeypatch):
    _owner(monkeypatch)
    _module()._gate()


@pytest.mark.parametrize(("key", "value"), [
    ("GITHUB_REPOSITORY", "untrusted/FootballForecast"),
    ("GITHUB_REF", "refs/heads/feature"),
    ("GITHUB_REF", "refs/tags/v1"),
    ("GITHUB_ACTOR", "someone-else"),
    ("GITHUB_ACTOR_ID", "42"),
    ("GITHUB_TRIGGERING_ACTOR", "someone-else"),
    ("GITHUB_EVENT_NAME", "pull_request"),
    ("GITHUB_EVENT_NAME", "schedule"),
    ("GITHUB_SHA", "short"),
    ("GITHUB_SHA", "Z" * 40),
    ("GITHUB_RUN_ID", "invalid-run"),
    ("GITHUB_RUN_ATTEMPT", ""),
    ("M4_CLUB_READONLY_GATE", "false"),
    ("M4_CLUB_READONLY_MODE", "M4_CLUB_WRITE"),
    ("ACTIONS_ID_TOKEN_REQUEST_URL", ""),
    ("ACTIONS_ID_TOKEN_REQUEST_TOKEN", ""),
])
def test_gate_refuses_wrong_owner_ref_trigger_oidc_or_permission(
    monkeypatch, key, value,
):
    _owner(monkeypatch)
    monkeypatch.setenv(key, value)
    with pytest.raises(DataError):
        _module()._gate()


def test_source_registry_contains_eight_exact_current_season_pages_and_no_holdout():
    module = _module()
    pinned = {url for _, url in CLUB_REPORTS.values()}
    assert len(pinned) == len(CLUB_REPORTS) == 8
    for url in pinned:
        assert url.startswith("https://")
        assert "2025/26" not in url
    assert "CLUB_REPORTS" in SCRIPT.read_text(encoding="utf-8")
    assert module.MAX_HTML == 8_000_000


def test_fetch_never_uses_unpinned_or_http_source():
    module = _module()
    opener = MagicMock()
    for url in (
        "https://attacker.example/fixture",
        "http://fc-rostov.ru/media/news/pobezhdaem-krylya-sovetov",
        "https://fc-rostov.ru/media/news/pobezhdaem-krylya-sovetov?season=2025",
        "https://www.rfs.ru/tournament/1434/calendar?round_id=18568",
    ):
        with pytest.raises(DataError):
            module._fetch_html(opener, url)
    opener.open.assert_not_called()


@pytest.mark.parametrize(("code", "ctype", "size"), [
    (404, "text/html", 1024),
    (200, "application/json", 1024),
    (200, "text/html", 100),
    (200, "text/html", 8_000_001),
])
def test_fetch_requires_bounded_current_html_without_redirects(code, ctype, size):
    module = _module()
    opener = MagicMock()
    response = MagicMock()
    response.status = code
    response.headers = {"Content-Type": ctype}
    response.read.return_value = b"x" * size
    opener.open.return_value.__enter__.return_value = response
    url = CLUB_REPORTS["rpl-2026-27-r15-20261120-1630"][1]
    with pytest.raises(DataError):
        module._fetch_html(opener, url)
    opener.open.assert_called_once()
    assert opener.open.call_args.kwargs["timeout"] == 15
    if code == 200 and ctype == "text/html":
        response.read.assert_called_once_with(8_000_001)
    else:
        response.read.assert_not_called()


def test_valid_exact_bounded_response_still_does_not_attest_result():
    module = _module()
    opener = MagicMock()
    response = MagicMock()
    response.status = 200
    response.headers = {"Content-Type": "text/html; charset=UTF-8"}
    response.read.return_value = b"synthetic-current-season-club-report" * 30
    opener.open.return_value.__enter__.return_value = response
    url = CLUB_REPORTS["rpl-2026-27-r15-20261120-1630"][1]
    assert module._fetch_html(opener, url) == response.read.return_value


def test_redirect_handler_has_no_fallback_or_allowlist_holes():
    module = _module()
    with pytest.raises(Exception, match="redirect"):
        module._NoRedirect().redirect_request(
            MagicMock(), None, 302, "Moved", {}, "https://attacker.example"
        )


def test_exact_owner_workflow_and_no_database_or_forecast_side_effects():
    script = SCRIPT.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")
    for required in (
        "github.repository == 'StanleyLl0yd/FootballForecast'",
        "github.ref == 'refs/heads/main'",
        "github.actor_id == '131160519'",
        "github.triggering_actor == 'StanleyLl0yd'",
        "github.event.issue.number == 333",
        "github.event.comment.body == '/m4-club-digests-readonly'",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.issue.pull_request",
        "environment: m1-source-import",
        "permissions: {contents: read, id-token: write}",
        "persist-credentials: false",
        "M4_CLUB_READONLY_MODE: M4_CLUB_READONLY",
        "M4_PRIVATE_CLUB_RAW_DIGESTS_UNATTESTED_READONLY",
        "row['githubDigestTimeVerified'] is not True",
        "'kdkClearanceAttested'",
    ):
        assert required in workflow
    assert "CLUB_REPORT_WORKFLOW" in script
    assert "verify_github_time_jwt(" in script
    assert "sha256(body).hexdigest()" in script
    assert "opener.open(" in script
    assert "HTTPRedirectHandler" in script
    assert "HTTPSHandler(context=ssl.create_default_context())" in script
    assert "clubBodies" in script and '"clubBodies": len(digests)' in script
    for forbidden in (
        "psycopg", "PGPASSWORD", "PGHOST", "SELECT ", "INSERT ",
        "UPDATE ", "DELETE ", "ALTER ", "DROP ", "CREATE TABLE",
        "public.ff_forecasts", "openfootapi.com",
        "matchtv.ru/football/rpl/",
    ):
        assert forbidden not in script
    for forbidden in (
        "secrets.PGPASSWORD", "secrets.M1_PGHOST", "secrets.OPENFOOT_API_KEY",
        "upload-artifact", "pull_request:", "schedule:",
        "contents: write",
    ):
        assert forbidden not in workflow
    assert "2025/26" not in workflow


def test_no_publisher_timestamp_or_kdk_clearance_claims_in_receipt():
    script = SCRIPT.read_text(encoding="utf-8")
    workflow = WORKFLOW.read_text(encoding="utf-8")
    for field in (
        "publisherFirstServingAttested", "officialMatchProtocolAttested",
        "onFieldPlayedAttested", "kdkClearanceAttested", "databaseWrite",
        "settlementAuthorized", "scoringAuthorized", "modelApproved",
        "publicationAuthorized", "holdout2025_26Read",
    ):
        assert '"' + field + '": False' in script
        assert "'" + field + "'" in workflow
    assert "githubDigestTimeVerified" in script
    assert "githubDigestTimeVerified" in workflow
    assert "batchTokenDigestSha256" in script
    assert "batchTokenDigestSha256" in workflow


def test_no_import_side_effects(monkeypatch):
    _owner(monkeypatch)
    # Module import itself never performs HTTP or executes a protected action.
    previous = sys.modules.get("psycopg")
    _module()
    assert sys.modules.get("psycopg") is previous


class _SyntheticUtc(datetime):
    @classmethod
    def now(cls, tz=None):
        assert tz == UTC
        return datetime(2026, 11, 23, 11, 0, 0, tzinfo=UTC)


def test_eight_source_digest_aggregate_never_prints_body_or_individual_match(
    monkeypatch, capsys,
):
    _owner(monkeypatch)
    module = _module()
    monkeypatch.setattr(module, "datetime", _SyntheticUtc)
    monkeypatch.setattr(module, "_keys_from_github", lambda: ({"kid": "synthetic"},))
    monkeypatch.setattr(
        module,
        "_fetch_html",
        lambda opener, url: ("synthetic-body-for-" + url).encode() * 9,
    )
    monkeypatch.setattr(
        module,
        "_token_for_audience",
        lambda audience, env: "synthetic-jwt-for-" + audience,
    )

    def fake_verify(token, audience, jwks, env, observed, verified, **kwargs):
        assert kwargs["workflow_ref"] == module.CLUB_REPORT_WORKFLOW
        assert token == "synthetic-jwt-for-" + audience
        assert audience.startswith(module.AUDIENCE)
        assert observed <= verified
        return "2026-11-23T11:00:00Z", '{"kid":"synthetic"}'

    monkeypatch.setattr(module, "verify_github_time_jwt", fake_verify)
    module.main()
    printed = capsys.readouterr().out.strip()
    data = loads(printed)
    assert data["clubBodies"] == 8
    assert data["kind"] == "M4_PRIVATE_CLUB_RAW_DIGESTS_UNATTESTED_READONLY"
    assert data["githubDigestTimeVerified"] is True
    assert data["publisherFirstServingAttested"] is False
    assert data["onFieldPlayedAttested"] is False
    assert data["kdkClearanceAttested"] is False
    assert data["databaseWrite"] is False
    assert data["settlementAuthorized"] is False
    assert data["scoringAuthorized"] is False
    assert data["holdout2025_26Read"] is False
    assert len(data["batchTokenDigestSha256"]) == 64
    assert set(data) == {
        "kind", "runId", "codeSha", "clubBodies", "batchTokenDigestSha256",
        "githubDigestTimeVerified", "publisherFirstServingAttested",
        "officialMatchProtocolAttested", "onFieldPlayedAttested",
        "kdkClearanceAttested", "databaseWrite", "settlementAuthorized",
        "scoringAuthorized", "modelApproved", "publicationAuthorized",
        "holdout2025_26Read",
    }
    assert "synthetic-body-for" not in printed
    assert "synthetic-jwt-for" not in printed
    assert "https://" not in printed
    for fixture_key in CLUB_REPORTS:
        assert fixture_key not in printed


def test_signed_token_issued_before_postgame_age_cannot_pass(
    monkeypatch,
):
    _owner(monkeypatch)
    module = _module()
    monkeypatch.setattr(module, "datetime", _SyntheticUtc)
    monkeypatch.setattr(module, "_keys_from_github", lambda: ({"kid": "test"},))
    monkeypatch.setattr(
        module, "_fetch_html",
        lambda opener, url: ("synthetic-body-" + url).encode() * 10,
    )
    monkeypatch.setattr(module, "_token_for_audience", lambda aud, env: aud)
    monkeypatch.setattr(
        module, "verify_github_time_jwt",
        lambda *args, **kwargs: ("2026-11-20T00:00:00Z", '{"kid":"test"}'),
    )
    with pytest.raises(DataError):
        module.main()


@pytest.mark.parametrize(("http_code", "reason"), [
    (301, "HTTP_OTHER"),
    (401, "HTTP_401"),
    (403, "HTTP_403"),
    (404, "HTTP_404"),
    (410, "HTTP_410"),
    (429, "HTTP_429"),
    (500, "HTTP_5XX"),
    (503, "HTTP_5XX"),
])
def test_http_failures_have_only_allowlisted_nonsecret_reason(http_code, reason):
    module = _module()
    opener = MagicMock()
    opener.open.side_effect = HTTPError(
        "https://untrusted.example/secret-path", http_code,
        "request contained confidential header", {}, None,
    )
    url = CLUB_REPORTS["rpl-2026-27-r15-20261120-1630"][1]
    with pytest.raises(DataError) as caught:
        module._fetch_html(opener, url)
    assert caught.value.cause == reason
    assert caught.value.cause in module._SAFE_CAUSES
    assert "confidential header" not in str(caught.value)
    assert "secret-path" not in str(caught.value)


def test_transport_failures_suppress_raw_exception_details():
    module = _module()
    opener = MagicMock()
    opener.open.side_effect = URLError(
        "network response carried private hostname"
    )
    url = CLUB_REPORTS["rpl-2026-27-r15-20261120-1630"][1]
    with pytest.raises(DataError) as caught:
        module._fetch_html(opener, url)
    assert caught.value.cause == "TRANSPORT"
    assert "private hostname" not in str(caught.value)


def test_redirect_refusal_has_no_user_selected_redirect_target():
    module = _module()
    with pytest.raises(DataError) as caught:
        module._NoRedirect().redirect_request(
            MagicMock(), None, 302, "redirect",
            {"Location": "https://untrusted.example/private"},
            "https://untrusted.example/private",
        )
    assert caught.value.cause == "REDIRECT"
    assert "untrusted.example" not in str(caught.value)


def test_untrusted_reason_never_escapes_allowlisted_codes():
    module = _module()
    error = module._ClubSourceRefusal("Dynamic server error unknown input")
    assert error.cause == "HTTP_OTHER"
    assert "Dynamic server error" not in str(error)


def test_club_seven_source_is_home_club_only_and_old_403_page_is_refused():
    """A changed source must be an explicit new pin, not a runtime fallback."""
    key = "rpl-2026-27-r15-20261122-1330"
    publisher, url = CLUB_REPORTS[key]
    assert publisher == "dynamo_makhachkala"
    assert url == "https://dinamo-mx.ru/news/dinamo-sygralo-vnichyu-so-spartakom-2/"
    assert len(CLUB_REPORTS) == 8
    assert len({page for _, page in CLUB_REPORTS.values()}) == 8
    old = "https://spartak.com/matches/5f5730c0-3698-4a75-a13a-158157ea11c7/broadcast"
    opener = MagicMock()
    with pytest.raises(DataError):
        _module()._fetch_html(opener, old)
    opener.open.assert_not_called()


def test_protocol_pdf_is_not_accepted_by_html_digest_worker():
    """Reference PDF is kept distinct from read-only HTML digest receipts."""
    from football_forecast.evaluation.m4_club_report_review import (
        MATCH_PROTOCOL_REFERENCES,
    )

    assert tuple(MATCH_PROTOCOL_REFERENCES) == ("rpl-2026-27-r15-20261122-1330",)
    number, pdf = MATCH_PROTOCOL_REFERENCES["rpl-2026-27-r15-20261122-1330"]
    assert number == "114"
    assert pdf == (
        "https://dinamo-mx.ru/wp-content/uploads/2026/11/"
        "rpl_2026-2027_md15_dmh-spa_fr_ru.pdf"
    )
    opener = MagicMock()
    with pytest.raises(DataError):
        _module()._fetch_html(opener, pdf)
    opener.open.assert_not_called()
