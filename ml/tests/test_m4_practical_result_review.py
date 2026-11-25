"""Synthetic practical A6 evidence claims; no external source or DB reads."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_club_report_review import (
    CLUB_REPORTS,
    MATCH_PROTOCOL_REFERENCES,
    SECOND_CLUB_REPORTS,
    DirectedGoalClaim,
    OfficialReportClaim,
    assess_practical_result_claims,
)
from football_forecast.evaluation.m4_postmatch_sources import MATCHTV_MATCH_IDS
from football_forecast.evaluation.m4_result_admission import (
    FrozenFixtureIdentity,
    ProviderResultClaim,
)
from football_forecast.research.m4_future_rpl_identity import DIRECTED

NOW = datetime(2026, 11, 24, 12, tzinfo=UTC)
EVENTS = ("KICKOFF", "HALF_TIME", "SECOND_HALF", "FULL_TIME")


def _case(slot="2026-11-21T12:15:00Z", score=(1, 2), protocol=False):
    kickoff = datetime.fromisoformat(slot)
    key = "rpl-2026-27-r15-" + kickoff.strftime("%Y%m%d-%H%M")
    home, away = DIRECTED[slot]
    fixture = FrozenFixtureIdentity(key, "synthetic:fixture", kickoff, home, away)
    common = dict(
        fixture_key=key, kickoff_at=kickoff, home_club_key=home,
        away_club_key=away, observed_at=kickoff + timedelta(hours=3),
        home_goals=score[0], away_goals=score[1],
        status="score_displayed_unverified", result_kind="unknown",
    )
    first = ProviderResultClaim(
        issuer="openfoot", source_fixture_ref=fixture.source_match_id,
        source_response_sha256="a" * 64, **common,
    )
    other = ProviderResultClaim(
        issuer="matchtv", source_fixture_ref="matchtv:" + MATCHTV_MATCH_IDS[key],
        source_response_sha256="b" * 64, **common,
    )
    goals = tuple(
        [DirectedGoalClaim(home, n + 1, 0) for n in range(score[0])]
        + [DirectedGoalClaim(away, score[0], n + 1) for n in range(score[1])]
    )
    if protocol:
        number, url = MATCH_PROTOCOL_REFERENCES[key]
        pins = (("rpl_protocol:" + number, url),)
    else:
        pins = (CLUB_REPORTS[key], SECOND_CLUB_REPORTS[key])
    witnesses = tuple(
        OfficialReportClaim(
            key, publisher, url, digest * 64, fixture.season, 15, kickoff,
            kickoff + timedelta(hours=4), home, away, *score, EVENTS, goals,
        )
        for (publisher, url), digest in zip(pins, "cd", strict=False)
    )
    return fixture, first, other, witnesses


def _assess(case=None):
    return assess_practical_result_claims(*(_case() if case is None else case), NOW)


def _mutate(**changes):
    f, a, b, w = _case()
    return f, a, b, (replace(w[0], **changes), w[1])


def _assert_no_authority(review):
    for flag in (
        "publisher_authenticated", "played_final_attested", "kdk_clearance_attested",
        "settlement_authorized", "scoring_authorized", "model_approved",
        "publication_authorized", "holdout_2025_26_read",
    ):
        assert getattr(review, flag) is False


def test_two_official_claims_are_candidate_only_and_known_kdk_pending():
    result = _assess()
    assert result.evidence_route == "OPPOSING_CLUB_REPORTS"
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_PENDING"
    _assert_no_authority(result)


def test_protocol_reference_alternative_does_not_require_publisher_signature():
    result = _assess(_case("2026-11-22T13:30:00Z", protocol=True))
    assert result.evidence_route == "PROTOCOL_REFERENCE"
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_UNREVIEWED"
    _assert_no_authority(result)


def test_no_agenda_listing_does_not_prove_clearance():
    result = _assess(_case("2026-11-20T16:30:00Z", score=(0, 0)))
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_UNREVIEWED"
    _assert_no_authority(result)


@pytest.mark.parametrize("changes", [
    {"season": "2025/26"},
    {"round_number": True},
    {"publisher": "unknown"},
    {"url": "https://attacker.example/report"},
    {"response_sha256": "a" * 64},
    {"response_sha256": "d" * 64},
    {"home_club": "fakel"},
    {"away_goals": True},
    {"events": ("KICKOFF", "FULL_TIME")},
    {"goals": ()},
    {"goals": (DirectedGoalClaim("akron", 1, 0),
               DirectedGoalClaim("fakel", 2, 0),
               DirectedGoalClaim("fakel", 3, 0))},
    {"goals": (DirectedGoalClaim("unknown", 1, 0),
               DirectedGoalClaim("fakel", 1, 1),
               DirectedGoalClaim("fakel", 1, 2))},
    {"goals": (DirectedGoalClaim("akron", True, 0),
               DirectedGoalClaim("fakel", 1, 1),
               DirectedGoalClaim("fakel", 1, 2))},
    {"observed_at": NOW + timedelta(seconds=1)},
])
def test_invalid_or_contradictory_semantics_fail_closed(changes):
    with pytest.raises(DataError):
        _assess(_mutate(**changes))


def test_two_valid_but_different_goal_sequences_are_not_corroborated():
    with pytest.raises(DataError):
        _assess(_mutate(goals=(
            DirectedGoalClaim("fakel", 0, 1),
            DirectedGoalClaim("akron", 1, 1),
            DirectedGoalClaim("fakel", 1, 2),
        )))


def test_same_publisher_twice_or_one_club_cannot_replace_official_pair():
    f, a, b, w = _case()
    for invalid in ((w[0], w[0]), (w[0],), (), (w[0], w[1], w[1])):
        with pytest.raises(DataError):
            _assess((f, a, b, invalid))


def test_known_pending_does_not_expire_automatically_after_hearing():
    case = _case()
    result = assess_practical_result_claims(*case, NOW + timedelta(days=10))
    assert result.classification == "PRIVATE_PRACTICAL_CANDIDATE_KDK_PENDING"
    _assert_no_authority(result)


def test_two_sources_must_still_agree_and_technical_claim_refused():
    f, a, b, w = _case()
    for invalid in (replace(a, result_kind="technical"), replace(a, away_goals=0)):
        with pytest.raises(DataError):
            _assess((f, invalid, b, w))


# Context binding tests share the same synthetic structural claims above.
def _binding_case(*, protocol=False):
    from hashlib import sha256

    f, a, b, w = _case(
        "2026-11-22T13:30:00Z" if protocol else "2026-11-21T12:15:00Z",
        protocol=protocol,
    )
    bodies = tuple(
        ("synthetic official witness " + str(i)).encode() * 40
        for i in range(len(w))
    )
    w = tuple(
        replace(report, response_sha256=sha256(body).hexdigest())
        for report, body in zip(w, bodies, strict=True)
    )
    return f, a, b, w, bodies


def _bindings(case=None, inspected_at=NOW):
    from football_forecast.evaluation.m4_official_witness_binding import (
        prepare_official_witness_bindings,
    )

    return prepare_official_witness_bindings(
        *(_binding_case() if case is None else case), inspected_at,
    )


@pytest.mark.parametrize("protocol", [False, True])
def test_official_witness_context_binding_is_canonical_and_unattested(protocol):
    from hashlib import sha256
    from json import loads

    case = _binding_case(protocol=protocol)
    f, a, b, witnesses, bodies = case
    rows = _bindings(case)
    assert len(rows) == len(witnesses)
    assert len({row.audience for row in rows}) == len(rows)
    for row, report in zip(rows, witnesses, strict=True):
        assert row.manifest_sha256 == sha256(row.manifest_bytes).hexdigest()
        assert row.audience.endswith(row.manifest_sha256)
        assert row.body_sha256 == report.response_sha256
        doc = loads(row.manifest_bytes)
        assert doc["fixture"]["sourceMatchId"] == f.source_match_id
        assert doc["fixture"]["fixtureKey"] == f.fixture_key
        assert doc["receiptPublisher"] == report.publisher
        assert len(doc["witnessClaims"]) == len(witnesses)
        assert doc["providerClaims"][0]["resultKind"] == "unknown"
        assert doc["providerClaims"][1]["resultKind"] == "unknown"
        assert row.github_digest_time_attested is False
        _assert_no_authority(row)
        assert "manifest_bytes" not in repr(row)
    assert rows == _bindings(case, NOW + timedelta(seconds=1))
    assert rows == tuple(reversed(_bindings(
        (f, a, b, tuple(reversed(witnesses)), tuple(reversed(bodies))),
    )))


def test_official_witness_binding_refuses_missing_swapped_or_changed_bytes():
    f, a, b, w, bodies = _binding_case()
    for invalid in (
        (), bodies[:1], tuple(reversed(bodies)),
        (bodies[0] + b"x", bodies[1]),
        (bytearray(bodies[0]), bodies[1]),
        (b"", bodies[1]),
    ):
        with pytest.raises(DataError):
            _bindings((f, a, b, w, invalid))


def test_official_witness_binding_changes_with_valid_context_even_for_same_bytes():
    f, a, b, w, bodies = _binding_case()
    original = _bindings((f, a, b, w, bodies))
    # Same body digests with a different claimed observation time, A5 identity
    # or provider digest must produce a different future token audience.
    changes = (
        (f, a, b, (
            replace(w[0], observed_at=w[0].observed_at + timedelta(seconds=1)), w[1],
        ), bodies),
        (
            replace(f, source_match_id="synthetic:other"),
            replace(a, source_fixture_ref="synthetic:other"), b, w, bodies,
        ),
        (f, replace(a, source_response_sha256="e" * 64), b, w, bodies),
    )
    for case in changes:
        revised = _bindings(case)
        assert all(x.audience != y.audience for x, y in zip(original, revised, strict=True))
        assert all(x.body_sha256 == y.body_sha256 for x, y in zip(original, revised, strict=True))


def test_official_witness_binding_inherits_structural_denials():
    f, a, b, w, bodies = _binding_case()
    for bad in (
        replace(w[0], publisher="untrusted"),
        replace(w[0], url="https://synthetic.invalid/other"),
        replace(w[0], events=("KICKOFF", "FULL_TIME")),
        replace(w[0], goals=()),
    ):
        with pytest.raises(DataError):
            _bindings((f, a, b, (bad, w[1]), bodies))


@pytest.fixture(scope="module")
def _receipt_signer():
    from cryptography.hazmat.primitives.asymmetric import rsa
    from json import loads
    from jwt.algorithms import RSAAlgorithm

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = loads(RSAAlgorithm.to_jwk(key.public_key()))
    jwk.update(kid="synthetic-witness-context", alg="RS256", use="sig")
    return key, jwk


def _signed_context_case(signer, *, protocol=False):
    import jwt
    from football_forecast.research.m4_github_time_attestation import (
        ACTOR, ACTOR_ID, CLUB_REPORT_WORKFLOW, ENVIRONMENT, ISSUER, REPO, REPO_ID,
    )

    key, jwk = signer
    now = datetime.now(UTC).replace(microsecond=0)
    f, a, b, w, bodies = _binding_case(protocol=protocol)
    w = tuple(replace(report, observed_at=now - timedelta(seconds=2)) for report in w)
    case = (f, a, b, w, bodies)
    env = {
        "GITHUB_REPOSITORY": REPO, "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": ACTOR, "GITHUB_EVENT_NAME": "issue_comment",
        "GITHUB_SHA": "a" * 40, "GITHUB_RUN_ID": "988876512",
        "GITHUB_RUN_ATTEMPT": "1",
    }

    def sign(audience, **changes):
        stamp = int(now.timestamp())
        claims = {
            "iss": ISSUER, "aud": audience,
            "sub": f"repo:{REPO}:environment:{ENVIRONMENT}",
            "iat": stamp, "nbf": stamp, "exp": stamp + 300,
            "jti": "synthetic-context-" + audience[-20:],
            "repository": REPO, "repository_id": REPO_ID,
            "actor": ACTOR, "actor_id": ACTOR_ID,
            "ref": "refs/heads/main", "sha": env["GITHUB_SHA"],
            "run_id": env["GITHUB_RUN_ID"], "run_attempt": env["GITHUB_RUN_ATTEMPT"],
            "environment": ENVIRONMENT, "workflow_ref": CLUB_REPORT_WORKFLOW,
            "event_name": env["GITHUB_EVENT_NAME"],
        }
        claims.update(changes)
        return jwt.encode(
            claims, key, algorithm="RS256", headers={"kid": jwk["kid"]},
        )

    bindings = _bindings(case, now)
    tokens = tuple(sign(binding.audience) for binding in bindings)
    return case, tokens, (jwk,), env, now, bindings, sign


def _verify_context(case, tokens, keys, env, now):
    from football_forecast.evaluation.m4_official_witness_binding import (
        verify_official_witness_receipts,
    )

    return verify_official_witness_receipts(*case, tokens, keys, env, now)


@pytest.mark.parametrize("protocol", [False, True])
def test_official_context_receipts_verify_only_runner_commitments(_receipt_signer, protocol):
    from hashlib import sha256

    case, tokens, keys, env, now, bindings, _ = _signed_context_case(
        _receipt_signer, protocol=protocol,
    )
    rows = _verify_context(case, tokens, keys, env, now)
    assert len(rows) == len(tokens)
    for row, token, binding in zip(rows, tokens, bindings, strict=True):
        assert row.manifest_sha256 == binding.manifest_sha256
        assert row.body_sha256 == binding.body_sha256
        assert row.token_sha256 == sha256(token.encode("ascii")).hexdigest()
        assert row.issued_at == now
        assert row.github_digest_time_attested is True
        _assert_no_authority(row)
        assert token not in repr(row)
        assert "signing_jwk_json" not in repr(row)


def test_official_context_receipts_deny_raw_digest_tokens_and_replay(_receipt_signer):
    from football_forecast.research.m4_github_time_attestation import POSTMATCH_WORKFLOW

    case, tokens, keys, env, now, bindings, sign = _signed_context_case(_receipt_signer)
    first, second = bindings
    bad_batches = (
        (), tokens[:1], (tokens[0], tokens[0]), tuple(reversed(tokens)),
        (sign("ff-m4-2026-27-club-report-sha256-" + first.body_sha256), tokens[1]),
        (sign(first.audience, workflow_ref=POSTMATCH_WORKFLOW), tokens[1]),
        (sign(first.audience, run_attempt="2"), tokens[1]),
        (sign(first.audience, sha="b" * 40), tokens[1]),
        (sign(second.audience), tokens[1]),
        ("invalid", tokens[1]), ("\u0442\u043e\u043a\u0435\u043d", tokens[1]),
    )
    for invalid in bad_batches:
        with pytest.raises(DataError):
            _verify_context(case, invalid, keys, env, now)
    for changed in (
        {**env, "GITHUB_RUN_ID": "988876513"},
        {**env, "GITHUB_RUN_ATTEMPT": "2"},
        {**env, "GITHUB_REF": "refs/heads/untrusted"},
    ):
        with pytest.raises(DataError):
            _verify_context(case, tokens, keys, changed, now)


def test_official_context_receipts_deny_tampering_and_stale_clocks(_receipt_signer):
    case, tokens, keys, env, now, bindings, sign = _signed_context_case(_receipt_signer)
    f, a, b, w, bodies = case
    for changed in (
        (f, a, b, w, (bodies[0] + b"x", bodies[1])),
        (f, replace(a, source_response_sha256="f" * 64), b, w, bodies),
        (f, a, b, (replace(w[0], observed_at=now - timedelta(seconds=1)), w[1]), bodies),
    ):
        with pytest.raises(DataError):
            _verify_context(changed, tokens, keys, env, now)
    with pytest.raises(DataError):
        _verify_context(case, tokens, keys, env, now + timedelta(minutes=6))
    # A correctly signed receipt that predates another claimed observation
    # by one second is refused even within the shared verifier's clock skew.
    before = int((now - timedelta(seconds=3)).timestamp())
    early = sign(bindings[0].audience, iat=before, nbf=before)
    with pytest.raises(DataError):
        _verify_context(case, (early, tokens[1]), keys, env, now)
    with pytest.raises(DataError):
        _verify_context(case, tokens, (), env, now)
    other_key = {**keys[0], "kid": "unknown"}
    with pytest.raises(DataError):
        _verify_context(case, tokens, (other_key,), env, now)
