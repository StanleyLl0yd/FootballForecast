#!/usr/bin/env python3
"""M4-A6: protected owner-only public club report raw-byte READONLY probe.

Only pinned club-operated pages describing 2026/27 round-15 matches.
No historical fixture search or follows, DB credentials, private A5 queries,
scores, predictions or fetched bodies in logs. Eight GitHub OIDC RS256 digest
time proofs verify PROTECTED runner observations, NOT publisher signatures
or original first-serving times. No played-final or KDK clearance.
"""
import os
import re
import ssl
import sys
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import dumps
from urllib.error import URLError
from urllib.request import HTTPRedirectHandler, HTTPSHandler, Request, build_opener

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import CLUB_REPORTS
from football_forecast.research.m4_github_time_attestation import (
    CLUB_REPORT_WORKFLOW,
    _keys_from_github,
    _token_for_audience,
    verify_github_time_jwt,
)

STAGE = "OWNER_GATE"
MAX_HTML = 8_000_000
AUDIENCE = "ff-m4-2026-27-club-report-sha256-"
GH_ENV_KEYS = (
    "GITHUB_REPOSITORY",
    "GITHUB_REF",
    "GITHUB_ACTOR",
    "GITHUB_EVENT_NAME",
    "GITHUB_SHA",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
)


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise URLError("M4-A6 unexpected club report redirect")


def _deny():
    raise DataError("M4-A6 protected club report read-only digest refusal")


def _gate():
    expected = {
        "GITHUB_REPOSITORY": "StanleyLl0yd/FootballForecast",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "StanleyLl0yd",
        "GITHUB_ACTOR_ID": "131160519",
        "GITHUB_TRIGGERING_ACTOR": "StanleyLl0yd",
        "M4_CLUB_READONLY_GATE": "true",
        "M4_CLUB_READONLY_MODE": "M4_CLUB_READONLY",
    }
    if (
        any(os.getenv(key) != value for key, value in expected.items())
        or os.getenv("GITHUB_EVENT_NAME") not in ("issue_comment", "workflow_dispatch")
        or re.fullmatch(r"[a-f0-9]{40}", os.getenv("GITHUB_SHA", "")) is None
        or not os.getenv("GITHUB_RUN_ID", "").isdigit()
        or not os.getenv("GITHUB_RUN_ATTEMPT", "").isdigit()
        or not os.getenv("ACTIONS_ID_TOKEN_REQUEST_URL")
        or not os.getenv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    ):
        _deny()


def _fetch_html(opener, url: str) -> bytes:
    if url not in {value[1] for value in CLUB_REPORTS.values()}:
        _deny()
    if not url.startswith("https://"):
        _deny()
    with opener.open(
        Request(
            url,
            headers={
                "Accept": "text/html",
                "User-Agent": "FootballForecast-M4-A6-Club-Readonly/1",
            },
            method="GET",
        ),
        timeout=15,
    ) as response:
        if (
            response.status != 200
            or "text/html" not in response.headers.get("Content-Type", "").lower()
        ):
            _deny()
        body = response.read(MAX_HTML + 1)
    if not 512 <= len(body) <= MAX_HTML:
        _deny()
    return body


def main():
    global STAGE
    _gate()
    if len(CLUB_REPORTS) != 8:
        _deny()
    STAGE = "TRUSTED_GITHUB_KEY_DISCOVERY"
    jwks = _keys_from_github()
    env = {key: os.environ[key] for key in GH_ENV_KEYS}
    opener = build_opener(
        _NoRedirect(), HTTPSHandler(context=ssl.create_default_context())
    )
    digests: list[str] = []
    for i, (fixture_key, (_publisher, url)) in enumerate(
        sorted(CLUB_REPORTS.items()), 1
    ):
        STAGE = "PINNED_CURRENT_SEASON_CLUB_" + str(i)
        if not fixture_key.startswith("rpl-2026-27-r15-"):
            _deny()
        # No generic match/season endpoints and no redirect-following.
        body = _fetch_html(opener, url)
        observed_at = datetime.now(UTC)
        primary_digest = sha256(body).hexdigest()
        del body
        STAGE = "GITHUB_CLUB_DIGEST_" + str(i)
        token = _token_for_audience(AUDIENCE + primary_digest, env)
        verified_at = datetime.now(UTC)
        issued, _public_jwk = verify_github_time_jwt(
            token, AUDIENCE + primary_digest, jwks, env,
            observed_at, verified_at, workflow_ref=CLUB_REPORT_WORKFLOW,
        )
        issued_at = datetime.fromisoformat(issued.replace("Z", "+00:00"))
        kickoff = datetime.strptime(
            fixture_key[-13:], "%Y%m%d-%H%M"
        ).replace(tzinfo=UTC)
        if (
            issued_at < kickoff + timedelta(minutes=90)
            or issued_at < observed_at.replace(microsecond=0)
            or issued_at > verified_at + timedelta(seconds=5)
        ):
            _deny()
        # No body, source URL, fixture score, or token is printed/uploaded.
        digests.append(sha256(
            (primary_digest + sha256(token.encode("ascii")).hexdigest()).encode()
        ).hexdigest())
    STAGE = "AGGREGATE_READONLY_RECEIPT"
    if len(digests) != 8 or len(set(digests)) != 8:
        _deny()
    print(dumps({
        "kind": "M4_PRIVATE_CLUB_RAW_DIGESTS_UNATTESTED_READONLY",
        "runId": os.environ["GITHUB_RUN_ID"],
        "codeSha": os.environ["GITHUB_SHA"],
        "clubBodies": len(digests),
        "batchTokenDigestSha256": sha256("|".join(digests).encode()).hexdigest(),
        "githubDigestTimeVerified": True,
        "publisherFirstServingAttested": False,
        "officialMatchProtocolAttested": False,
        "onFieldPlayedAttested": False,
        "kdkClearanceAttested": False,
        "databaseWrite": False,
        "settlementAuthorized": False,
        "scoringAuthorized": False,
        "modelApproved": False,
        "publicationAuthorized": False,
        "holdout2025_26Read": False,
    }, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # A hard-coded stage and ordinal ONLY, no body, source link, JWT or key.
        print("M4_PRIVATE_CLUB_READONLY_REFUSED_AT=" + STAGE, file=sys.stderr)
        sys.exit(2)
