"""Synthetic-only A6 unknown-played raw-byte/OIDC verifier regression tests."""
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
    CORROBORATION_AUDIENCE,
    PRIMARY_AUDIENCE,
)
from football_forecast.evaluation.m4_unattested_digest import (
    verify_unattested_postmatch_score_digests,
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
KICKOFF = datetime(2026, 11, 21, 14, 30, tzinfo=UTC)
BODY1 = b'{"data":[{"id":"synthetic:fixture.1","score":{"home":2,"away":1}}]}'
BODY2 = b"<html><body>" + b"current-season-calendar-2-to-1 " * 22 + b"</body></html>"
ENV = {
    "GITHUB_REPOSITORY": REPO, "GITHUB_REF": "refs/heads/main",
    "GITHUB_ACTOR": ACTOR, "GITHUB_EVENT_NAME": "issue_comment",
    "GITHUB_SHA": "a" * 40, "GITHUB_RUN_ID": "45123456789",
    "GITHUB_RUN_ATTEMPT": "1",
}


def _token(signer, audience, *, changes=None, workflow=POSTMATCH_WORKFLOW):
    issued = int(NOW.timestamp())
    claims = {
        "iss": ISSUER, "aud": audience,
        "sub": f"repo:{REPO}:environment:{ENVIRONMENT}",
        "iat": issued, "nbf": issued, "exp": issued + 300,
        "jti": "a6-unattested-" + audience[-20:],
        "repository": REPO, "repository_id": REPO_ID,
        "actor": ACTOR, "actor_id": ACTOR_ID,
        "ref": "refs/heads/main", "sha": ENV["GITHUB_SHA"],
        "run_id": ENV["GITHUB_RUN_ID"],
        "run_attempt": ENV["GITHUB_RUN_ATTEMPT"],
        "environment": ENVIRONMENT, "workflow_ref": workflow,
        "event_name": "issue_comment",
    }
    claims.update(changes or {})
    return jwt.encode(
        claims, signer, algorithm="RS256", headers={"kid": "a6-unknown-played-test"},
    )


def _case(*, workflow=POSTMATCH_WORKFLOW):
    fixture = FrozenFixtureIdentity(
        fixture_key="rpl-2026-27-r15-20261121-1430",
        source_match_id="synthetic:fixture.1",
        kickoff_at=KICKOFF,
        home_club_key="rubin",
        away_club_key="zenit",
    )
    common = dict(
        fixture_key=fixture.fixture_key, kickoff_at=fixture.kickoff_at,
        home_club_key=fixture.home_club_key,
        away_club_key=fixture.away_club_key,
        competition="RPL", season="2026/27", home_goals=2, away_goals=1,
        status="score_displayed_unverified", result_kind="unknown",
    )
    primary = ProviderResultClaim(
        issuer="openfoot", source_fixture_ref=fixture.source_match_id,
        source_response_sha256=sha256(BODY1).hexdigest(),
        observed_at=NOW - timedelta(seconds=3), **common,
    )
    other = ProviderResultClaim(
        issuer="matchtv", source_fixture_ref="matchtv:552665047",
        source_response_sha256=sha256(BODY2).hexdigest(),
        observed_at=NOW - timedelta(seconds=2), **common,
    )
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = loads(RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update({"kid": "a6-unknown-played-test", "alg": "RS256", "use": "sig"})
    token1 = _token(
        key, PRIMARY_AUDIENCE + sha256(BODY1).hexdigest(), workflow=workflow,
    )
    token2 = _token(
        key, CORROBORATION_AUDIENCE + sha256(BODY2).hexdigest(), workflow=workflow,
    )
    return dict(
        fixture=fixture, primary=primary, corroboration=other,
        primary_body=BODY1, corroboration_body=BODY2,
        primary_token=token1, corroboration_token=token2,
        trusted_github_jwks=(jwk,), github_env=ENV,
        verified_at=NOW + timedelta(seconds=1),
    )


def test_unknown_played_digest_clocks_never_authorize_final_or_scoring():
    r = verify_unattested_postmatch_score_digests(**_case())
    assert r.classification == "PRIVATE_UNATTESTED_SCORE_DIGEST_CLOCKS"
    assert r.fixture_key == "rpl-2026-27-r15-20261121-1430"
    assert r.primary_issued_at == NOW
    assert r.corroboration_issued_at == NOW
    assert r.primary_token_sha256 != r.corroboration_token_sha256
    assert loads(r.primary_jwk_json)["kid"] == "a6-unknown-played-test"
    assert loads(r.corroboration_jwk_json)["kid"] == "a6-unknown-played-test"
    assert r.github_digest_time_attested is True
    for denied in (
        "publisher_authenticity_attested",
        "independent_played_final_attested",
        "settlement_authorized", "scoring_authorized",
        "model_approved", "publication_authorized", "holdout_2025_26_read",
    ):
        assert getattr(r, denied) is False


def test_even_explicit_openfoot_played_does_not_prove_matchtv_played():
    values = _case()
    values["primary"] = replace(
        values["primary"], status="finished", result_kind="played",
    )
    r = verify_unattested_postmatch_score_digests(**values)
    assert r.independent_played_final_attested is False
    assert r.scoring_authorized is False


@pytest.mark.parametrize("changes", [
    {"primary_body": BODY1 + b"tampered"},
    {"corroboration_body": BODY2 + b"tampered"},
    {"primary_body": b""},
    {"corroboration_body": b"too small"},
    {"verified_at": NOW + timedelta(minutes=6)},
    {"github_env": {**ENV, "GITHUB_REF": "refs/heads/feature"}},
    {"github_env": {**ENV, "GITHUB_RUN_ATTEMPT": "3"}},
    {"primary_token": ""},
    {"trusted_github_jwks": ({"kty": "oct", "kid": "a6-unknown-played-test"},)},
])
def test_raw_byte_clock_or_signer_tampering_is_denied(changes):
    with pytest.raises(DataError):
        verify_unattested_postmatch_score_digests(**(_case() | changes))


@pytest.mark.parametrize("part, changes", [
    ("fixture", {"fixture_key": "rpl-" + "2026-27-r15-other"}),
    ("fixture", {"season": "2025/26"}),
    ("fixture", {"home_club_key": "zenit"}),
    ("primary", {"source_fixture_ref": "wrong:provider.fixture"}),
    ("primary", {"result_kind": "technical"}),
    ("primary", {"result_kind": "unknown", "status": "finished"}),
    ("primary", {"home_goals": 3}),
    ("primary", {"home_goals": True}),
    ("corroboration", {"status": "finished", "result_kind": "played"}),
    ("corroboration", {"source_fixture_ref": "matchtv:wrong"}),
    ("corroboration", {"away_goals": 2}),
    ("corroboration", {"observed_at": NOW - timedelta(minutes=6)}),
    ("corroboration", {"observed_at": NOW + timedelta(seconds=10)}),
])
def test_untrusted_claims_never_bypass_identity_played_or_time(part, changes):
    values = _case()
    values[part] = replace(values[part], **changes)
    with pytest.raises(DataError):
        verify_unattested_postmatch_score_digests(**values)


def test_swapped_or_wrong_workflow_tokens_denied():
    values = _case()
    values["primary_token"], values["corroboration_token"] = (
        values["corroboration_token"], values["primary_token"]
    )
    with pytest.raises(DataError):
        verify_unattested_postmatch_score_digests(**values)
    # A correctly signed JWT from the wrong protected workflow is refused.
    with pytest.raises(DataError):
        verify_unattested_postmatch_score_digests(
            **_case(workflow=PROSPECTIVE_WORKFLOW),
        )


def test_no_external_source_or_database_access_in_pure_evidence_module():
    from pathlib import Path

    path = (Path(__file__).resolve().parents[1] /
            "src/football_forecast/evaluation/m4_unattested_digest.py")
    code = path.read_text(encoding="utf-8")
    for forbidden in (
        "psycopg.connect", "requests.get", "urllib.request",
        "public.ff_forecasts", "2025/26 holdout",
    ):
        assert forbidden not in code
