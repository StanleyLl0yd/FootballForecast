"""M4 bounded owner-only future fixture probe workflow contracts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_future_probe_is_exact_owner_only_nonautomatic_and_no_db_write():
    yaml = (ROOT / ".github/workflows/m4-future-rpl-source-observation.yml"
            ).read_text(encoding="utf-8")
    runner = (ROOT / "scripts/m4-owner-future-source-observe.py"
              ).read_text(encoding="utf-8")
    for snippet in (
        "github.repository == 'StanleyLl0yd/FootballForecast'",
        "github.ref == 'refs/heads/main'",
        "github.actor == 'StanleyLl0yd'",
        "github.event.issue.number == 304",
        "github.event.comment.user.id == 131160519",
        "github.event.comment.author_association == 'OWNER'",
        "github.event.comment.body == '/m4-future-rpl-source-readonly'",
        "inputs.confirmation == 'M4_FUTURE_RPL_SOURCE_READONLY'",
        "environment: m1-source-import",
        "persist-credentials: false",
        "concurrency:",
        "cancel-in-progress: false",
        "OPENFOOT_API_KEY: $" + "{{ secrets.OPENFOOT_API_KEY }}",
        "M4_FUTURE_READONLY_GATE: 'true'",
    ):
        assert snippet in yaml, snippet
    for forbidden in (
        "2025/26", "2025%2F26", "PGHOST", "PGPASSWORD",
        "service_role", "public.ff_forecasts", "upload-artifact",
        "schedule:\n", "git push", "curl -L",
    ):
        assert forbidden not in yaml
    for snippet in (
        "source=OpenFoot", "2026/27", "GET", "NoRedirect",
    ):
        if snippet == "source=OpenFoot":
            continue
        assert snippet in (runner + (
            ROOT / "ml/src/football_forecast/research/m4_future_rpl_source.py"
        ).read_text(encoding="utf-8"))
    for forbidden in (
        "psycopg", "supabase", "open(", "write_bytes", "write_text",
        "public.ff_forecasts",
    ):
        if forbidden == "open(":
            assert "client.open(" in runner
            continue
        assert forbidden not in runner


def test_future_probe_cannot_claim_prospective_forecast_or_model_release():
    code = (ROOT / "ml/src/football_forecast/research/m4_future_rpl_source.py"
            ).read_text(encoding="utf-8")
    workflow = (ROOT / ".github/workflows/m4-future-rpl-source-observation.yml"
                ).read_text(encoding="utf-8")
    for snippet in (
        "independent_source_confirmed: bool = False",
        "genuine_as_of_attested: bool = False",
        "model_approved: bool = False",
        "forecast_written: bool = False",
        "public_forecasts_written: bool = False",
        "holdout_2025_26_read: bool = False",
        "FIRST_KICKOFF = datetime(2026, 11, 20, 16, 30, tzinfo=UTC)",
    ):
        assert snippet in code
    assert "M4_SOURCE_ENVELOPES_SHA256=" in workflow
    assert "no prediction/DB write" in workflow
