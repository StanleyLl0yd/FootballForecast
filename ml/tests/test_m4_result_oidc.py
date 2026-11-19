"""Synthetic M4-A6 GitHub RS256 post-match byte/time proof regression tests.

All scores, identities, JWTs and JWKS are generated locally. No real results,
secrets, network calls, database changes, 2025/26 data or public predictions.
"""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from json import loads

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.evaluation.m4_result_oidc import (
    verify_postmatch_digest_clock,
)
from football_forecast.research.m4_github_time_attestation import (
    ACTOR,
    ACTOR_ID,
    ENVIRONMENT,
    ISSUER,
    POSTMATCH_WORKFLOW,
    PROSPECTIVE_WORKFLOW,
    REPO,
    REPO_ID,
)

NOW = datetime.now(UTC).replace(microsecond=0)
KICKOFF = datetime(2026, 11, 13, 16, 30, tzinfo=UTC)
OPENFOOT_BODY = (
    b'{"data":[{"id":"provider:synthetic.1","status":"finished",'
    b'"resultKind":"played","score":{"home":2,"away":1}}]}'
)
MATCHTV_BODY = b"<html><body>" + (b"synthetic independent 2:1 " * 28) + b"</body></html>"
ENV = {
    "GITHUB_REPOSITORY": REPO,
    "GITHUB_REF": "refs/heads/main",
    "GITHUB_ACTOR": ACTOR,
    "GITHUB_EVENT_NAME": "issue_comment",
    "GITHUB_SHA": "a" * 40,
    "GITHUB_RUN_ID": "44512345678",
    "GITHUB_RUN_ATTEMPT": "1",
}


def _signed(key, audience, *, claims_override=None, workflow=POSTMATCH_WORKFLOW):
    sec = int(NOW.timestamp())
    claims = {
        "aud": audience,
        "iss": ISSUER,
        "sub": f"repo:{REPO}:environment:{ENVIRONMENT}",
        "exp": sec + 300,
        "iat": sec,
        "nbf": sec,
        "jti": "m4-postmatch-test-unique-" + audience[-15:],
        "repository": REPO,
        "repository_id": REPO_ID,
        "actor": ACTOR,
        "actor_id": ACTOR_ID,
        "ref": "refs/heads/main",
        "sha": ENV["GITHUB_SHA"],
        "run_id": ENV["GITHUB_RUN_ID"],
        "run_attempt": ENV["GITHUB_RUN_ATTEMPT"],
        "environment": ENVIRONMENT,
        "workflow_ref": workflow,
        "event_name": "issue_comment",
    }
    claims.update(claims_override or {})
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "synthetic-a6-kid"})


def _case(*, primary_override=None, corroboration_override=None,
          primary_claims=None, corroboration_claims=None,
          workflow=POSTMATCH_WORKFLOW):
    fixture = FrozenFixtureIdentity(
        fixture_key="rpl-" + "synthetic-a6-oidc",
        source_match_id="provider:synthetic.1",
        kickoff_at=KICKOFF,
        home_club_key="club_home",
        away_club_key="club_away",
    )
    common = dict(
        fixture_key=fixture.fixture_key,
        kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key,
        status="finished",
        result_kind="played",
        home_goals=2,
        away_goals=1,
    )
    primary = ProviderResultClaim(
        issuer="openfoot",
        source_fixture_ref="provider:synthetic.1",
        source_response_sha256=sha256(OPENFOOT_BODY).hexdigest(),
        observed_at=NOW - timedelta(seconds=3),
        **common,
    )
    corroboration = ProviderResultClaim(
        issuer="matchtv",
        source_fixture_ref="independent:synthetic.1",
        source_response_sha256=sha256(MATCHTV_BODY).hexdigest(),
        observed_at=NOW - timedelta(seconds=2),
        **common,
    )
    primary = replace(primary, **(primary_override or {}))
    corroboration = replace(corroboration, **(corroboration_override or {}))
    signer = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = loads(RSAAlgorithm.to_jwk(signer.public_key()))
    jwk.update({"kid": "synthetic-a6-kid", "alg": "RS256", "use": "sig"})
    token1 = _signed(
        signer, "ff-m4-2026-27-openfoot-sha256-" + sha256(OPENFOOT_BODY).hexdigest(),
        claims_override=primary_claims, workflow=workflow,
    )
    token2 = _signed(
        signer, "ff-m4-2026-27-matchtv-sha256-" + sha256(MATCHTV_BODY).hexdigest(),
        claims_override=corroboration_claims, workflow=workflow,
    )
    return dict(
        fixture=fixture,
        primary=primary,
        corroboration=corroboration,
        primary_body=OPENFOOT_BODY,
        corroboration_body=MATCHTV_BODY,
        primary_token=token1,
        corroboration_token=token2,
        trusted_github_jwks=(jwk,),
        github_env=ENV,
        verified_at=NOW + timedelta(seconds=1),
    )


def test_valid_gitHub_signed_byte_clocks_still_do_not_attest_played_truth():
    result = verify_postmatch_digest_clock(**_case())
    assert result.github_digest_time_attested is True
    assert result.primary_issued_at == NOW
    assert result.corroboration_issued_at == NOW
    assert result.primary_token_sha256 != result.corroboration_token_sha256
    assert result.candidate.classification == "PRIVATE_RESULT_CANDIDATE_UNATTESTED"
    assert result.candidate.source_time_attested is False
    assert result.candidate.settlement_authorized is False
    assert loads(result.primary_jwk_json)["kid"] == "synthetic-a6-kid"
    for denied in (
        "publisher_authenticity_attested",
        "played_final_attested",
        "settlement_authorized",
        "scoring_authorized",
        "publication_authorized",
        "holdout_2025_26_read",
    ):
        assert getattr(result, denied) is False


@pytest.mark.parametrize("changed", [
    {"primary_body": OPENFOOT_BODY + b"tampered"},
    {"corroboration_body": MATCHTV_BODY + b"tampered"},
    {"primary_body": MATCHTV_BODY},
    {"corroboration_body": OPENFOOT_BODY},
    {"primary_body": b""},
    {"primary_body": bytearray(OPENFOOT_BODY)},
    {"corroboration_body": b"x" * 8_000_001},
    {"primary_token": ""},
    {"github_env": {**ENV, "GITHUB_REF": "refs/heads/unprotected"}},
    {"github_env": {**ENV, "GITHUB_SHA": "b" * 40}},
    {"verified_at": NOW + timedelta(minutes=6)},
])
def test_tampered_body_replay_environment_and_clock_refused(changed):
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**(_case() | changed))


@pytest.mark.parametrize("part, changes", [
    ("primary_override", {"source_response_sha256": "b" * 64}),
    ("corroboration_override", {"source_fixture_ref": "provider:synthetic.1"}),
    ("primary_override", {"source_fixture_ref": "wrong-provider"}),
    ("primary_override", {"status": "awarded"}),
    ("corroboration_override", {"result_kind": "technical"}),
    ("primary_override", {"home_goals": 3}),
    ("corroboration_override", {"away_goals": 0}),
    ("primary_override", {"observed_at": KICKOFF + timedelta(minutes=45)}),
    ("primary_override", {"observed_at": NOW + timedelta(seconds=15)}),
    ("primary_override", {"observed_at": NOW - timedelta(seconds=1)}),
    ("primary_override", {"observed_at": NOW - timedelta(minutes=6)}),
    ("corroboration_override", {"observed_at": NOW + timedelta(seconds=1)}),
])
def test_wrong_or_technical_claims_and_time_order_are_rejected(part, changes):
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**_case(**{part: changes}))


@pytest.mark.parametrize("part, changes", [
    ("primary_claims", {"repository_id": "invalid"}),
    ("primary_claims", {"workflow_ref": PROSPECTIVE_WORKFLOW}),
    ("primary_claims", {"event_name": "pull_request"}),
    ("corroboration_claims", {"actor_id": "21"}),
    ("corroboration_claims", {"run_attempt": "2"}),
    ("corroboration_claims", {"ref": "refs/heads/other"}),
    ("primary_claims", {"aud": "ff-m4-2026-27-matchtv-sha256-" + "0" * 64}),
])
def test_wrong_oidc_identity_or_purpose_is_rejected(part, changes):
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**_case(**{part: changes}))


def test_swapping_gitHub_signed_source_tokens_refused():
    values = _case()
    values["primary_token"], values["corroboration_token"] = (
        values["corroboration_token"], values["primary_token"]
    )
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**values)


def test_old_prospective_workflow_is_not_postmatch_signer():
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**_case(workflow=PROSPECTIVE_WORKFLOW))


def test_self_signed_different_key_is_not_trusted():
    values = _case()
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    new_key = loads(RSAAlgorithm.to_jwk(other.public_key()))
    new_key.update({"kid": "synthetic-a6-kid", "alg": "RS256", "use": "sig"})
    values["trusted_github_jwks"] = (new_key,)
    with pytest.raises(DataError):
        verify_postmatch_digest_clock(**values)
