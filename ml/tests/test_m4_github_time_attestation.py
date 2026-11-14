"""Synthetic adversarial verification of GitHub-signed prospective source clocks."""
from datetime import UTC, datetime, timedelta
from json import loads

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_github_time_attestation import (
    ACTOR,
    ACTOR_ID,
    ENVIRONMENT,
    ISSUER,
    REPO,
    REPO_ID,
    WORKFLOW,
    verify_github_time_jwt,
)

NOW = datetime.now(UTC).replace(microsecond=0)
SHA = "a" * 40
AUD = "ff-m4-2026-27-openfoot-sha256-" + "b" * 64
ENV = {
    "GITHUB_REPOSITORY": REPO, "GITHUB_REF": "refs/heads/main",
    "GITHUB_ACTOR": ACTOR, "GITHUB_EVENT_NAME": "issue_comment",
    "GITHUB_SHA": SHA, "GITHUB_RUN_ID": "43200000001",
    "GITHUB_RUN_ATTEMPT": "1",
}


def signed_case(*, changes=None, header_changes=None, other_signer=False):
    issuer_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    signing_key = (
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
        if other_signer else issuer_key
    )
    jwk = loads(RSAAlgorithm.to_jwk(issuer_key.public_key()))
    jwk.update({"kid": "m4-fixed-test", "alg": "RS256", "use": "sig"})
    secs = int(NOW.timestamp())
    claim = {
        "aud": AUD, "iss": ISSUER, "sub": f"repo:{REPO}:environment:{ENVIRONMENT}",
        "exp": secs + 300, "iat": secs, "nbf": secs, "jti": "m4-token-test-unique-123",
        "repository": REPO, "repository_id": REPO_ID, "actor": ACTOR,
        "actor_id": ACTOR_ID, "ref": "refs/heads/main", "sha": SHA,
        "run_id": ENV["GITHUB_RUN_ID"], "run_attempt": ENV["GITHUB_RUN_ATTEMPT"],
        "environment": ENVIRONMENT, "workflow_ref": WORKFLOW,
        "event_name": "issue_comment",
    }
    claim.update(changes or {})
    header = {"kid": "m4-fixed-test"}
    header.update(header_changes or {})
    token = jwt.encode(claim, signing_key, algorithm="RS256", headers=header)
    return token, (jwk,)


def validate(token, jwks, env=None, observed=NOW - timedelta(seconds=2),
             verified=NOW + timedelta(seconds=2), audience=AUD):
    return verify_github_time_jwt(
        token, audience, jwks, env or ENV, observed, verified,
    )


def test_valid_oidc_signature_claims_and_digest_binding():
    token, jwks = signed_case()
    issued_utc, public_jwk = validate(token, jwks)
    assert issued_utc == NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
    assert loads(public_jwk)["kid"] == "m4-fixed-test"
    assert len(public_jwk) > 200


@pytest.mark.parametrize(("changed", "value"), [
    ("repository", "Other/Repo"),
    ("repository_id", "3"),
    ("actor", "someone_else"),
    ("actor_id", "42"),
    ("event_name", "pull_request"),
    ("workflow_ref", "Evil/Workflow"),
    ("ref", "refs/heads/untrusted"),
    ("sha", "c" * 40),
    ("environment", "untrusted"),
    ("run_id", "456"),
    ("run_attempt", "8"),
    ("sub", "repo:Evil/Repo:environment:m1-source-import"),
    ("aud", AUD[:-1] + "0"),
    ("iss", "https://untrusted.example"),
    ("iat", int(NOW.timestamp()) - 400),
    ("exp", int(NOW.timestamp()) + 1200),
])
def test_fail_closed_on_claim_or_time_change(changed, value):
    token, keys = signed_case(changes={changed: value})
    with pytest.raises(DataError):
        validate(token, keys)


def test_forged_or_mismatched_signer_fails():
    token, jwks = signed_case(other_signer=True)
    with pytest.raises(DataError):
        validate(token, jwks)


def test_untrusted_oidc_jku_not_fetched_or_accepted():
    token, jwks = signed_case(header_changes={"jku": "https://evil.invalid/key"})
    with pytest.raises(DataError):
        validate(token, jwks)


def test_wrong_audience_or_signing_key_material_is_refused():
    token, jwks = signed_case()
    with pytest.raises(DataError):
        validate(token, jwks, audience="ff-m4-2026-27-matchtv-sha256-" + "f" * 64)
    with pytest.raises(DataError):
        validate(token, ({"kid": "m4-fixed-test", "kty": "oct",
                          "k": "c2VjcmV0", "use": "sig"},))


def test_local_clock_and_origin_boundaries_fail_closed():
    token, jwks = signed_case()
    with pytest.raises(DataError):
        validate(token, jwks, observed=NOW + timedelta(seconds=60))
    with pytest.raises(DataError):
        validate(token, jwks, verified=NOW + timedelta(minutes=6))
    with pytest.raises(DataError):
        validate(token, jwks, env={**ENV, "GITHUB_REF": "refs/heads/not-main"})
