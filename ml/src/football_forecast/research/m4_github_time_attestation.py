"""M4-A5 GitHub-issued independent server-time proof of protected source digests.

The GitHub OIDC issuer signs the audience (which binds source bytes hashed by
protected code), job identity, run_id and issuance UTC. These proofs DO NOT
establish the publisher's first-serving timestamp or its own signature. The
source and kickoff publishers are independent; both JWTs have the SAME GitHub
signing authority. An immutable PostgreSQL server-clock commit remains required
before any genuine prospective-as-of claim. Never print JWTs or JWKS contents.
"""
import os
import re
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from json import dumps, loads
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import (
    HTTPRedirectHandler, HTTPSHandler, Request, build_opener,
)

import jwt
from jwt.algorithms import RSAAlgorithm

from football_forecast.data.contracts import DataError

ISSUER = "https://token.actions.githubusercontent.com"
DISCOVERY = ISSUER + "/.well-known/openid-configuration"
JWKS = ISSUER + "/.well-known/jwks"
REPO = "StanleyLl0yd/FootballForecast"
REPO_ID = "1422508335"
ACTOR = "StanleyLl0yd"
ACTOR_ID = "131160519"
WORKFLOW = (REPO +
            "/.github/workflows/m4-future-rpl-source-observation.yml@refs/heads/main")
ENVIRONMENT = "m1-source-import"
SHA = re.compile(r"^[a-f0-9]{64}$")
COMMIT = re.compile(r"^[a-f0-9]{40}$")
MAX_JWT = 10000
MAX_JWKS = 100000
MAX_PROOF_AGE = 300


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise DataError("M4 OIDC unexpected redirect")


@dataclass(frozen=True, slots=True)
class ProtectedTimeProof:
    """Private live signatures. Never serialize as public outputs or artifacts."""
    source_jwt: str
    kickoff_jwt: str
    source_jwk_json: str
    kickoff_jwk_json: str
    source_issued_utc: str
    kickoff_issued_utc: str

    @property
    def source_token_sha256(self):
        return sha256(self.source_jwt.encode("ascii")).hexdigest()

    @property
    def kickoff_token_sha256(self):
        return sha256(self.kickoff_jwt.encode("ascii")).hexdigest()


def _deny():
    raise DataError("M4: trusted GitHub OIDC time proof refused")


def _https_json(url: str, *, headers=None, limit=MAX_JWKS):
    opener = build_opener(_NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(Request(url, headers=headers or {"Accept": "application/json"},
                             method="GET"), timeout=10) as response:
        if response.status != 200 or "json" not in response.headers.get(
                "Content-Type", "").lower():
            _deny()
        raw = response.read(limit + 1)
    if not 2 <= len(raw) <= limit:
        _deny()
    def pairs(values):
        row = {}
        for key, value in values:
            if key in row:
                _deny()
            row[key] = value
        return row
    try:
        return loads(raw.decode("utf-8", "strict"), object_pairs_hook=pairs)
    except (UnicodeError, ValueError) as exc:
        raise DataError("M4: invalid OIDC JSON") from exc


def _keys_from_github() -> tuple[dict, ...]:
    metadata = _https_json(DISCOVERY, limit=16000)
    if (type(metadata) is not dict or metadata.get("issuer") != ISSUER or
            metadata.get("jwks_uri") != JWKS or
            "RS256" not in metadata.get("id_token_signing_alg_values_supported", [])):
        _deny()
    response = _https_json(JWKS)
    keys = response.get("keys") if type(response) is dict else None
    if type(keys) is not list or not 1 <= len(keys) <= 40:
        _deny()
    return tuple(keys)


def _expected_identity(env: dict[str, str]):
    required = {
        "GITHUB_REPOSITORY": REPO,
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": ACTOR,
    }
    if any(env.get(k) != v for k, v in required.items()):
        _deny()
    if (env.get("GITHUB_EVENT_NAME") not in {"issue_comment", "workflow_dispatch"}
            or not COMMIT.fullmatch(env.get("GITHUB_SHA", ""))
            or not env.get("GITHUB_RUN_ID", "").isdigit()
            or not env.get("GITHUB_RUN_ATTEMPT", "").isdigit()):
        _deny()


def _claims_time(value):
    if type(value) is not int or not 1_000_000_000 <= value <= 4_000_000_000:
        _deny()
    return value


def verify_github_time_jwt(
    token: str, audience: str, jwks: tuple[dict, ...],
    env: dict[str, str], observed_at: datetime, verified_at: datetime,
) -> tuple[str, str]:
    """Pure detached-signature validation against already verified issuer keys.

    Returns (issuance UTC, canonical public signing JWK). Does not authorize DB
    writes by itself. Runtime JWKS MUST come from fixed HTTPS issuer discovery.
    """
    _expected_identity(env)
    if (type(token) is not str or not 400 <= len(token) <= MAX_JWT or
            type(audience) is not str or len(audience) > 256 or
            not audience.startswith("ff-m4-2026-27-") or
            not isinstance(observed_at, datetime) or observed_at.tzinfo != UTC or
            not isinstance(verified_at, datetime) or verified_at.tzinfo != UTC or
            type(jwks) is not tuple or not 1 <= len(jwks) <= 40):
        _deny()
    try:
        header = jwt.get_unverified_header(token)
        if (header.get("alg") != "RS256" or
                type(header.get("kid")) is not str or
                not 1 <= len(header["kid"]) <= 256 or
                any(k in header for k in ("jku", "x5u", "jwk", "x5c"))):
            _deny()
        matching = [
            key for key in jwks if type(key) is dict and
            key.get("kid") == header["kid"] and key.get("kty") == "RSA" and
            key.get("use", "sig") == "sig" and
            key.get("alg", "RS256") == "RS256" and
            type(key.get("n")) is str and type(key.get("e")) is str
        ]
        if len(matching) != 1:
            _deny()
        public_key = RSAAlgorithm.from_jwk(dumps(matching[0]))
        claims = jwt.decode(
            token, public_key, algorithms=["RS256"], audience=audience, issuer=ISSUER,
            options={"require": [
                "exp", "iat", "nbf", "jti", "sub", "aud", "iss",
                "repository", "repository_id", "actor", "actor_id",
                "ref", "sha", "run_id", "run_attempt", "environment",
                "workflow_ref", "event_name",
            ]},
            leeway=5,
        )
    except (ValueError, TypeError, jwt.PyJWTError) as exc:
        raise DataError("M4: invalid cryptographic time signature") from exc
    exact = {
        "repository": REPO, "repository_id": REPO_ID, "actor": ACTOR,
        "actor_id": ACTOR_ID, "ref": "refs/heads/main",
        "sha": env["GITHUB_SHA"], "run_id": env["GITHUB_RUN_ID"],
        "run_attempt": env["GITHUB_RUN_ATTEMPT"], "environment": ENVIRONMENT,
        "workflow_ref": WORKFLOW, "event_name": env["GITHUB_EVENT_NAME"],
        "sub": f"repo:{REPO}:environment:{ENVIRONMENT}",
    }
    if (any(claims.get(k) != v for k, v in exact.items()) or
            claims.get("aud") != audience or
            type(claims.get("jti")) is not str or
            not 12 <= len(claims["jti"]) <= 512):
        _deny()
    issued = _claims_time(claims.get("iat"))
    not_before = _claims_time(claims.get("nbf"))
    expires = _claims_time(claims.get("exp"))
    observed = observed_at.timestamp()
    verified = verified_at.timestamp()
    if (not_before > issued + 5 or expires <= issued or expires > issued + 900
            or issued + 5 < observed or issued > verified + 5
            or verified - issued > MAX_PROOF_AGE):
        _deny()
    return datetime.fromtimestamp(issued, UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), dumps(
        matching[0], sort_keys=True, separators=(",", ":"),
    )


def _token_for_audience(audience: str, env: dict[str, str]) -> str:
    base = env.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    token = env.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    parsed = urlsplit(base)
    if (parsed.scheme != "https" or
            parsed.hostname not in {"pipelines.actions.githubusercontent.com",
                                   "token.actions.githubusercontent.com"} or
            parsed.username is not None or parsed.password is not None or
            parsed.port not in (None, 443) or not token or len(token) > 6000 or
            len(base) > 2000):
        _deny()
    values = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    if any(key == "audience" for key, _ in values):
        _deny()
    url = urlunsplit((
        parsed.scheme, parsed.netloc, parsed.path,
        urlencode([*values, ("audience", audience)]), "",
    ))
    doc = _https_json(url, headers={
        "Accept": "application/json", "Authorization": "Bearer " + token,
    }, limit=16000)
    result = doc.get("value") if type(doc) is dict else None
    if type(result) is not str:
        _deny()
    return result


def attest_future_source_digests(
    source_sha: str, kickoff_sha: str, source_observed: datetime,
    kickoff_observed: datetime, *, env: dict[str, str] | None = None,
) -> ProtectedTimeProof:
    """Both publisher bytes must already have been fetched and checked LIVE."""
    if env is None:
        env = dict(os.environ)
    _expected_identity(env)
    if (type(source_sha) is not str or not SHA.fullmatch(source_sha)
            or type(kickoff_sha) is not str or not SHA.fullmatch(kickoff_sha)
            or source_sha == kickoff_sha
            or not isinstance(source_observed, datetime) or
            not isinstance(kickoff_observed, datetime) or
            source_observed.tzinfo != UTC or kickoff_observed.tzinfo != UTC or
            source_observed > kickoff_observed):
        _deny()
    audience_source = "ff-m4-2026-27-openfoot-sha256-" + source_sha
    audience_kickoff = "ff-m4-2026-27-matchtv-sha256-" + kickoff_sha
    # Independent provider observations. Two GitHub-signed audiences, not
    # two independent OIDC issuers. Never call these third-party-signed.
    source_jwt = _token_for_audience(audience_source, env)
    kickoff_jwt = _token_for_audience(audience_kickoff, env)
    jwks = _keys_from_github()
    verified_at = datetime.now(UTC)
    a_utc, a_jwk = verify_github_time_jwt(
        source_jwt, audience_source, jwks, env, kickoff_observed, verified_at)
    b_utc, b_jwk = verify_github_time_jwt(
        kickoff_jwt, audience_kickoff, jwks, env, kickoff_observed, verified_at)
    if source_jwt == kickoff_jwt or a_utc > b_utc:
        _deny()
    return ProtectedTimeProof(
        source_jwt=source_jwt, kickoff_jwt=kickoff_jwt,
        source_jwk_json=a_jwk, kickoff_jwk_json=b_jwk,
        source_issued_utc=a_utc, kickoff_issued_utc=b_utc,
    )
