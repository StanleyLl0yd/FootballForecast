#!/usr/bin/env python3
"""Protected owner-only M4-A6 read-only 2026/27 post-match evidence probe.

Read immutable A5 identity/forecast kind, then newly fetch bounded OpenFoot
single-fixture responses and separately pinned MatchTV match pages. Validate
source-specific *claims*, corroborate scores, and independently GitHub-sign
each pair of freshly acquired raw-response digests. This is NOT played-final
attestation or result settlement. No PostgreSQL INSERT/UPDATE/DELETE, no
scores, probabilities, JWTs, private IDs or source bodies in logs/artifacts.
"""
import os
import ssl
import sys
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import dumps
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import (
    HTTPRedirectHandler, HTTPSHandler, Request, build_opener,
)

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_postmatch_sources import (
    A5PostmatchAnchor, MATCHTV_MATCH_IDS,
    parse_matchtv_result_candidate, parse_openfoot_score_observation,
)
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
)
from football_forecast.evaluation.m4_result_oidc import (
    CORROBORATION_AUDIENCE, PRIMARY_AUDIENCE,
)
from football_forecast.evaluation.m4_unattested_digest import (
    verify_unattested_postmatch_score_digests,
)
from football_forecast.research.m4_future_rpl_independent import MATCHTV_URL
from football_forecast.research.m4_future_rpl_source import COMPETITION
from football_forecast.research.m4_github_time_attestation import (
    _keys_from_github, _token_for_audience,
)

STAGE = "OWNER_GATE"
MAX_JSON = 150_000
MAX_HTML = 8_000_000
FROZEN_MODEL_SHA = "b3eeb4cf950c38507572c6c6b4e3db7f133cf7cc2ee0593b2d940c66394b0a0c"
GH_ENV_KEYS = (
    "GITHUB_REPOSITORY", "GITHUB_REF", "GITHUB_ACTOR", "GITHUB_EVENT_NAME",
    "GITHUB_SHA", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT",
    "ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
)


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise URLError("M4 A6 redirect refused")


def _deny():
    raise DataError("M4-A6 protected readonly verification refused")


def _gate():
    expected = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_ACTOR_ID": "131160519",
        "GITHUB_TRIGGERING_ACTOR": "StanleyLl0yd",
        "M4_RESULT_READONLY_GATE": "true",
        "M4_RESULT_READONLY_MODE": "M4_RESULT_READONLY",
    }
    if (any(os.getenv(k) != v for k, v in expected.items())
            or os.getenv("GITHUB_EVENT_NAME") not in ("issue_comment", "workflow_dispatch")
            or not os.getenv("GITHUB_RUN_ID", "").isdigit()
            or not os.getenv("GITHUB_RUN_ATTEMPT", "").isdigit()
            or len(os.getenv("GITHUB_SHA", "")) != 40):
        _deny()
    key = os.getenv("OPENFOOT_API_KEY", "")
    if not key.startswith("of_live_") or not 16 <= len(key) <= 264:
        _deny()
    for name in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLROOTCERT"):
        if not os.getenv(name):
            _deny()
    return key


def _connection():
    import psycopg
    return psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        dbname=os.environ["PGDATABASE"], password=os.environ["PGPASSWORD"],
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options="-c default_transaction_read_only=on -c statement_timeout=90000",
    )


def _read_immutable_a5():
    with _connection() as conn, conn.cursor() as cur:
        cur.execute("set transaction isolation level REPEATABLE READ READ ONLY")
        cur.execute(
            """select c.fixture_key,c.kickoff_at,c.home_club_key,c.away_club_key,
                      p.source_match_id,p.home_provider_team_id,
                      p.away_provider_team_id,c.captured_at,p.committed_at,
                      e.entry_kind,e.entry_state,e.committed_at,
                      e.publication_allowed,e.holdout_2025_26_read,e.revision,
                      m.model_sha256,m.model_state,m.production_approved,
                      m.public_release_allowed,m.holdout_2025_26_read
               from ff_private.ff_m4_future_captures c
               join ff_private.ff_m4_time_proofs p on p.capture_id=c.id
               join ff_private.ff_m4_shadow_entries e on e.capture_id=c.id
               join ff_private.ff_m4_candidate_models m on m.id=e.model_id
               where c.competition='RPL' and c.season='2026/27'
                 and c.fixture_key like 'rpl-2026-27-r15-%'
               order by c.kickoff_at,c.fixture_key"""
        )
        rows = cur.fetchall()
        conn.rollback()
    if len(rows) != 8:
        _deny()
    anchors = []
    kinds = []
    seen_ids = set()
    for row in rows:
        (key, kickoff, home, away, source_id, home_id, away_id, captured,
         proof_committed, kind, state, shadow_committed, publication, holdout,
         revision, model_sha, model_state, approved, public_model, holdout_model) = row
        if (type(key) is not str or key in seen_ids
                or not isinstance(kickoff, datetime)
                or kickoff.utcoffset() != timedelta(0)
                or not (captured < kickoff - timedelta(minutes=15)
                        and proof_committed < kickoff - timedelta(minutes=15)
                        and shadow_committed < kickoff - timedelta(minutes=15))
                or revision != 1
                or kind not in ("FORECAST", "ABSTAIN")
                or state != "PRIVATE_SHADOW_UNAPPROVED"
                or publication is not False or holdout is not False
                or model_sha != FROZEN_MODEL_SHA
                or model_state != "SHADOW_CANDIDATE_UNAPPROVED"
                or approved is not False or public_model is not False
                or holdout_model is not False):
            _deny()
        seen_ids.add(key)
        anchors.append(A5PostmatchAnchor(
            fixture=FrozenFixtureIdentity(
                fixture_key=key, source_match_id=source_id,
                kickoff_at=kickoff.astimezone(UTC),
                home_club_key=home, away_club_key=away,
            ),
            home_provider_id=home_id,
            away_provider_id=away_id,
        ))
        kinds.append(kind)
    if set(seen_ids) != set(MATCHTV_MATCH_IDS):
        _deny()
    if kinds.count("FORECAST") != 6 or kinds.count("ABSTAIN") != 2:
        _deny()
    return tuple(anchors), tuple(kinds)


def _fetch(opener, url, headers, content_type, limit):
    with opener.open(Request(url, headers=headers, method="GET"), timeout=15) as response:
        if response.status != 200 or content_type not in response.headers.get(
            "Content-Type", ""
        ).lower():
            _deny()
        raw = response.read(limit + 1)
    if not 2 <= len(raw) <= limit:
        _deny()
    return raw


def main():
    global STAGE
    key = _gate()
    STAGE = "IMMUTABLE_A5_READ"
    anchors, kinds = _read_immutable_a5()
    opener = build_opener(_NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    STAGE = "TRUSTED_GITHUB_KEY_DISCOVERY"
    jwks = _keys_from_github()
    STAGE = "LIVE_POSTMATCH_CLAIMS"
    digests = []
    github_env = {name: os.environ[name] for name in GH_ENV_KEYS}
    for ordinal, anchor in enumerate(anchors, 1):
        fixture = anchor.fixture
        STAGE = "POSTMATCH_SOURCE_" + str(ordinal)
        query = urlencode({
            "competition": COMPETITION,
            "season": "2026/27",
            "date": fixture.kickoff_at.date().isoformat(),
            "team": anchor.home_provider_id,
        })
        primary_body = _fetch(
            opener, "https://openfootapi.com/v1/matches?" + query,
            {"Accept": "application/json", "Authorization": "Bearer " + key,
             "User-Agent": "FootballForecast-M4-A6-Owner-Readonly/1"},
            "application/json", MAX_JSON,
        )
        primary_observed = datetime.now(UTC)
        primary = parse_openfoot_score_observation(
            primary_body, anchor, primary_observed,
        )
        STAGE = "POSTMATCH_INDEPENDENT_" + str(ordinal)
        # Only the current-season round-15 calendar. Individual MatchTV
        # detail pages embed the sealed 2025/26 H2H and MUST NOT be fetched.
        corroboration_body = _fetch(
            opener, MATCHTV_URL,
            {"Accept": "text/html", "User-Agent": "FootballForecast-M4-A6-Readonly/1"},
            "text/html", MAX_HTML,
        )
        corroboration_observed = datetime.now(UTC)
        corroboration = parse_matchtv_result_candidate(
            corroboration_body, anchor, corroboration_observed,
        )
        STAGE = "POSTMATCH_GITHUB_DIGEST_" + str(ordinal)
        primary_token = _token_for_audience(
            PRIMARY_AUDIENCE + primary.source_response_sha256, github_env,
        )
        corroboration_token = _token_for_audience(
            CORROBORATION_AUDIENCE + corroboration.source_response_sha256,
            github_env,
        )
        evidence = verify_unattested_postmatch_score_digests(
            fixture, primary, corroboration, primary_body,
            corroboration_body, primary_token, corroboration_token,
            jwks, github_env, datetime.now(UTC),
        )
        if (not evidence.github_digest_time_attested
                or evidence.publisher_authenticity_attested
                or evidence.independent_played_final_attested
                or evidence.settlement_authorized
                or evidence.scoring_authorized
                or evidence.publication_authorized
                or evidence.model_approved
                or evidence.holdout_2025_26_read):
            _deny()
        # Only digest-derived opaque proof, never scores or match details.
        digests.append(sha256(
            (evidence.primary_token_sha256 +
             evidence.corroboration_token_sha256).encode()
        ).hexdigest())
    STAGE = "FINAL_READONLY_RECEIPT"
    print(dumps({
        "kind": "M4_PRIVATE_POSTMATCH_UNATTESTED_READONLY",
        "runId": os.environ["GITHUB_RUN_ID"],
        "codeSha": os.environ["GITHUB_SHA"],
        "fixtures": len(anchors),
        "forecasts": kinds.count("FORECAST"),
        "abstentions": kinds.count("ABSTAIN"),
        "candidates": len(digests),
        "batchTokenDigestSha256": sha256("|".join(digests).encode()).hexdigest(),
        "githubDigestTimeVerified": True,
        "publisherAuthenticityAttested": False,
        "playedFinalAttested": False,
        "databaseWrite": False,
        "settlementAuthorized": False,
        "scoringAuthorized": False,
        "publicationAuthorized": False,
        "holdout2025_26Read": False,
    }, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Only a bounded hard-coded stage and fixture ordinal, no credentials,
        # private source content, team names, IDs, scores, JWTs or response.
        print("M4_PRIVATE_POSTMATCH_REFUSED_AT=" + STAGE, file=sys.stderr)
        sys.exit(2)
