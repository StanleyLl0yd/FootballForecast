#!/usr/bin/env python3
"""Owner-only one-transaction M4-A5 future private shadow batch. Never public.

The immutable server-clock capture, signed JWTs/public signing keys, frozen
model decision and first shadow revision are inserted in one SERIALIZABLE
PostgreSQL transaction. On any unknown history club identity ABSTAIN, never
guess a mapping; on any stale source/clock/issuer/DB violation ROLLBACK.
All source bytes, team IDs, JWTs, model coefficients and scores stay PRIVATE.
"""
import os
import ssl
import sys
from datetime import UTC, datetime
from json import dumps
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_future_rpl_independent import (
    MATCHTV_URL,
    MAX_CALENDAR_BYTES,
    verify_live_matchtv_calendar,
)
from football_forecast.research.m4_future_rpl_source import (
    CALENDAR,
    COMPETITION,
    MAX_BYTES_PER_DAY,
    inspect_future_rpl_source,
)
from football_forecast.research.m4_future_shadow import (
    FROZEN_MODEL_SHA256,
    entry_idempotency_sha256,
    future_fixtures_from_validated_source,
    private_shadow_decision,
    sealed_candidate_from_row,
)
from football_forecast.research.m4_github_time_attestation import (
    PROSPECTIVE_WORKFLOW,
    attest_future_source_digests,
)

STAGE = "OWNER_GATE"
COMMIT_MARKER = "M4_PRIVATE_CAPTURE_COMMIT"
DRY_RUN_MARKER = "M4_PRIVATE_CAPTURE_DRY_RUN"


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise URLError("source redirect forbidden")


def _gate() -> bool:
    if (
        os.getenv("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
        or os.getenv("GITHUB_REF") != "refs/heads/main"
        or os.getenv("GITHUB_ACTOR") != "StanleyLl0yd"
        or os.getenv("GITHUB_EVENT_NAME") not in ("issue_comment", "workflow_dispatch")
        or not os.getenv("GITHUB_RUN_ID", "").isdigit()
        or not os.getenv("GITHUB_RUN_ATTEMPT", "").isdigit()
        or len(os.getenv("GITHUB_SHA", "")) != 40
    ):
        raise DataError("M4: protected owner capture gate unavailable")
    write_gate = os.getenv("M4_CAPTURE_GATED")
    mode = os.getenv("M4_PROSPECTIVE_MODE")
    if write_gate == "true" and mode == COMMIT_MARKER:
        return True
    if write_gate == "false" and mode == DRY_RUN_MARKER:
        return False
    raise DataError("M4: mismatched owner command and write authorization")


def _live_sources() -> tuple[dict[str, bytes], object, str, datetime]:
    key = os.getenv("OPENFOOT_API_KEY", "")
    if not key.startswith("of_live_") or not 16 <= len(key) <= 264:
        raise DataError("M4: authenticated source credential unavailable")
    client = build_opener(_NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    days = {}
    for day in CALENDAR:
        url = "https://openfootapi.com/v1/matches?competition=" + COMPETITION + "&date=" + day
        request = Request(
            url, headers={
                "Accept": "application/json", "Authorization": "Bearer " + key,
                "User-Agent": "FootballForecast-M4-Owner-Private-Prospective/1",
            }, method="GET",
        )
        with client.open(request, timeout=15) as response:
            if (response.status != 200 or
                    "application/json" not in response.headers.get("Content-Type", "").lower()):
                raise DataError("M4: invalid authenticated source response")
            days[day] = response.read(MAX_BYTES_PER_DAY + 1)
            if not 2 <= len(days[day]) <= MAX_BYTES_PER_DAY:
                raise DataError("M4: invalid source byte count")
    receipt = inspect_future_rpl_source(days, datetime.now(UTC))
    request = Request(
        MATCHTV_URL, headers={
            "Accept": "text/html",
            "User-Agent": "FootballForecast-M4-Private-Schedule-Corroboration/1",
        }, method="GET",
    )
    with client.open(request, timeout=15) as response:
        if (response.status != 200 or
                "text/html" not in response.headers.get("Content-Type", "").lower()):
            raise DataError("M4: independent publisher unavailable")
        calendar = response.read(MAX_CALENDAR_BYTES + 1)
    observed = datetime.now(UTC)
    digest = verify_live_matchtv_calendar(calendar, observed)
    return days, receipt, digest, observed


def _pg_connection(*, read_only: bool):
    import psycopg

    return psycopg.connect(
        host=os.environ["PGHOST"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],
        sslmode="verify-full",
        sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options=(
            "-c statement_timeout=90000 -c default_transaction_read_only=on"
            if read_only else "-c statement_timeout=90000"
        ),
    )


def _read_model(cursor):
    cursor.execute(
        """select id,model_version,training_scope,training_matches,
           distinct_clubs,source_manifest_sha256,eligible_rows_sha256,
           model_sha256,model_bytes,model_state,production_approved,
           public_release_allowed,holdout_2025_26_read,github_run_id
           from ff_private.ff_m4_candidate_models
           where model_sha256=%s for share""",
        (FROZEN_MODEL_SHA256,),
    )
    row = cursor.fetchone()
    if row is None or cursor.fetchone() is not None:
        raise DataError("M4: exact frozen private model absent or ambiguous")
    return sealed_candidate_from_row(row)


def _insert_private_batch(cursor, fixtures, decisions, model_id, proof,
                          source_digest, kickoff_digest):
    source_at = datetime.fromisoformat(
        proof.source_issued_utc.replace("Z", "+00:00"))
    kickoff_at = datetime.fromisoformat(
        proof.kickoff_issued_utc.replace("Z", "+00:00"))
    source_hash = proof.source_token_sha256
    kickoff_hash = proof.kickoff_token_sha256
    if source_at.tzinfo != UTC or kickoff_at.tzinfo != UTC:
        raise DataError("M4: invalid server-signed timestamps")
    cursor.execute(
        """select fixture_key from ff_private.ff_m4_future_captures
           where fixture_key = any(%s) limit 1""",
        ([f.fixture_key for f in fixtures],),
    )
    if cursor.fetchone() is not None:
        raise DataError("M4: original private prospective capture already exists")

    run_id = int(os.environ["GITHUB_RUN_ID"])
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    sha = os.environ["GITHUB_SHA"]
    for fixture, decision in zip(fixtures, decisions, strict=True):
        cursor.execute(
            """insert into ff_private.ff_m4_future_captures
               (fixture_key,competition,season,home_club_key,away_club_key,
                kickoff_at,status,revision_kind,source_revision_sha256,
                kickoff_evidence_sha256,team_mapping_sha256,
                source_issuer,kickoff_issuer,source_mac_sha256,kickoff_mac_sha256,
                source_observed_at,kickoff_observed_at)
               values (%s,'RPL','2026/27',%s,%s,%s,'scheduled','none',
                       %s,%s,%s,'openfoot','matchtv',%s,%s,%s,%s)
               returning id""",
            (fixture.fixture_key, fixture.home_slug, fixture.away_slug,
             fixture.kickoff, source_digest, kickoff_digest,
             fixture.mapping_sha256, source_hash, kickoff_hash,
             source_at, kickoff_at),
        )
        capture_id = cursor.fetchone()[0]
        cursor.execute(
            """insert into ff_private.ff_m4_time_proofs
               (capture_id,github_run_id,github_run_attempt,code_sha,
                source_match_id,home_provider_team_id,away_provider_team_id,
                source_oidc_jwt,kickoff_oidc_jwt,source_jwk,kickoff_jwk,
                source_token_sha256,kickoff_token_sha256,
                source_issued_at,kickoff_issued_at)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,
                       %s,%s,%s,%s)""",
            (capture_id, run_id, attempt, sha, fixture.source_match_id,
             fixture.home_provider_id, fixture.away_provider_id,
             proof.source_jwt, proof.kickoff_jwt,
             proof.source_jwk_json, proof.kickoff_jwk_json,
             source_hash, kickoff_hash, source_at, kickoff_at),
        )
        cursor.execute(
            """insert into ff_private.ff_m4_shadow_entries
               (capture_id,model_id,fixture_key,revision,idempotency_sha256,
                entry_kind,abstention_reason,home_win,draw,away_win,
                expected_home,expected_away,prediction_sha256)
               values (%s,%s,%s,1,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (capture_id, model_id, fixture.fixture_key,
             entry_idempotency_sha256(
                 fixture, FROZEN_MODEL_SHA256, source_hash, kickoff_hash,
             ),
             decision.kind, decision.reason, decision.home_win,
             decision.draw, decision.away_win, decision.expected_home,
             decision.expected_away, decision.prediction_sha256),
        )

    cursor.execute(
        """select count(*) from ff_private.ff_m4_shadow_entries e
           join ff_private.ff_m4_time_proofs p on p.capture_id=e.capture_id
           where p.github_run_id=%s and p.github_run_attempt=%s
           and e.entry_state='PRIVATE_SHADOW_UNAPPROVED'
           and e.publication_allowed=false and e.holdout_2025_26_read=false""",
        (run_id, attempt),
    )
    if cursor.fetchone()[0] != 8:
        raise DataError("M4: incomplete source/proof/model shadow transaction")


def main():
    global STAGE
    STAGE = "OWNER_GATE"
    commit = _gate()
    STAGE = "SOURCE_AND_CALENDAR_FETCH"
    days, receipt, calendar_digest, calendar_observed = _live_sources()
    STAGE = "IDENTITY_VALIDATE"
    fixtures = future_fixtures_from_validated_source(days)
    STAGE = "OIDC_ATTEST"
    source_observed = datetime.fromisoformat(
        receipt.observation_completed_utc.replace("Z", "+00:00"))
    proof = attest_future_source_digests(
        receipt.source_envelopes_sha256, calendar_digest,
        source_observed, calendar_observed,
        workflow_ref=PROSPECTIVE_WORKFLOW,
    )
    STAGE = "DATABASE_READ"
    with _pg_connection(read_only=not commit) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "set transaction isolation level " +
                ("SERIALIZABLE" if commit else "REPEATABLE READ READ ONLY")
            )
            model_id, candidate = _read_model(cursor)
            decisions = tuple(private_shadow_decision(candidate, f)
                              for f in fixtures)
            if any(d.kind not in ("FORECAST", "ABSTAIN") for d in decisions):
                raise DataError("M4: invalid private shadow decision")
            if commit:
                STAGE = "DATABASE_WRITE"
                _insert_private_batch(
                    cursor, fixtures, decisions, model_id, proof,
                    receipt.source_envelopes_sha256, calendar_digest,
                )
                STAGE = "DATABASE_COMMIT"
                conn.commit()
            else:
                cursor.execute(
                    "select to_regclass('ff_private.ff_m4_time_proofs') is not null"
                )
                if cursor.fetchone()[0] is not True:
                    raise DataError("M4: private signed-time escrow migration absent")
                conn.rollback()
    STAGE = "PRIVATE_RECEIPT"
    # Only global digest, 8-fixture counts, and state. NO per-fixture
    # probabilities, provider IDs, JWTs, historical data or private bytes.
    print(dumps({
        "kind": ("M4_PRIVATE_PROSPECTIVE_COMMITTED" if commit
                 else "M4_PRIVATE_PROSPECTIVE_DRY_RUN"),
        "runId": os.environ["GITHUB_RUN_ID"],
        "codeSha": os.environ["GITHUB_SHA"],
        "sourceSha256": receipt.source_envelopes_sha256,
        "calendarSha256": calendar_digest,
        "sourceOidcTokenSha256": proof.source_token_sha256,
        "kickoffOidcTokenSha256": proof.kickoff_token_sha256,
        "modelSha256": FROZEN_MODEL_SHA256,
        "fixtures": len(fixtures),
        "forecasts": sum(d.kind == "FORECAST" for d in decisions),
        "abstentions": sum(d.kind == "ABSTAIN" for d in decisions),
        "persisted": commit,
        "publicForecastsWritten": False,
        "modelApproved": False,
        "holdoutRead": False,
    }, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("M4_PRIVATE_PROSPECTIVE_REFUSED_AT=" + STAGE, file=sys.stderr)
        sys.exit(2)
