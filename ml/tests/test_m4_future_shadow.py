"""M4-A5 synthetic future private execution; NO real model/source/DB writes."""
from dataclasses import replace
from datetime import UTC, datetime
from hashlib import sha256
from json import dumps

import pytest
from test_m4_future_rpl_identity import _encode, _rows

from football_forecast.data.contracts import DataError
from football_forecast.research import m4_future_shadow
from football_forecast.research.m4_future_shadow import (
    FutureFixture,
    entry_idempotency_sha256,
    future_fixtures_from_validated_source,
    private_shadow_decision,
    sealed_candidate_from_row,
)
from football_forecast.research.m4_private_candidate import MODEL_VERSION


def _sealed(monkeypatch):
    payload = {
        "schema": 1,
        "version": MODEL_VERSION,
        "state": "SHADOW_CANDIDATE_UNAPPROVED",
        "trainingMatches": 1673,
        "distinctClubs": 26,
        "sourceManifestSha256": "1" * 64,
        "eligibleRowsSha256": "2" * 64,
        "leagueHome": 1.42,
        "leagueAway": 1.18,
        "teams": [[f"team_{i}", 20, 20, 25, 18, 22, 24] for i in range(26)],
        "productionApproved": False,
        "publicForecastsAuthorized": False,
        "holdout2025_26Read": False,
    }
    raw = dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    digest = sha256(raw).hexdigest()
    monkeypatch.setattr(m4_future_shadow, "FROZEN_MODEL_SHA256", digest)
    return sealed_candidate_from_row((
        "11111111-1111-1111-1111-111111111111",
        MODEL_VERSION, "2018/19-2024/25-development-only",
        1673, 26, "1" * 64, "2" * 64, digest, raw,
        "SHADOW_CANDIDATE_UNAPPROVED", False, False, False, 4320000000,
    ))


def _fixture(home="team_0", away="team_1"):
    return FutureFixture(
        fixture_key="rpl-2026-27-r15-20261121-1430",
        source_match_id="match_123",
        kickoff=datetime(2026, 11, 21, 14, 30, tzinfo=UTC),
        home_slug="rubin", away_slug="zenit",
        home_provider_id=home, away_provider_id=away,
    )


def test_validated_provider_names_and_ids_yield_eight_immutable_candidates():
    items = future_fixtures_from_validated_source(_encode(_rows()))
    assert len(items) == 8
    assert items[0].home_slug == "rostov"
    assert items[-1].away_slug == "lokomotiv"
    assert len({v.fixture_key for v in items}) == 8
    assert len({v.mapping_sha256 for v in items}) == 8
    assert all(v.kickoff.tzinfo == UTC for v in items)


def test_unknown_model_club_abstains_and_never_fakes_probabilities(monkeypatch):
    _, candidate = _sealed(monkeypatch)
    decision = private_shadow_decision(candidate, _fixture(home="unreviewed"))
    assert decision.kind == "ABSTAIN"
    assert decision.reason == "UNKNOWN_MODEL_CLUB_ID"
    assert decision.home_win is None
    assert decision.prediction_sha256 is None


def test_known_model_clubs_make_a_proper_private_model_decision(monkeypatch):
    _, candidate = _sealed(monkeypatch)
    result = private_shadow_decision(candidate, _fixture())
    assert result.kind == "FORECAST"
    assert result.reason is None
    assert result.home_win + result.draw + result.away_win == pytest.approx(1)
    assert result.expected_home > 0
    assert result.expected_away > 0
    assert len(result.prediction_sha256) == 64


def test_swapped_team_changes_mapping_and_prediction_hash(monkeypatch):
    _, candidate = _sealed(monkeypatch)
    fixture = _fixture()
    swapped = _fixture(home="team_1", away="team_0")
    assert fixture.mapping_sha256 != swapped.mapping_sha256
    original = private_shadow_decision(candidate, fixture)
    changed = private_shadow_decision(candidate, swapped)
    assert original.prediction_sha256 != changed.prediction_sha256


def test_wrong_or_tampered_stored_model_refused(monkeypatch):
    _, candidate = _sealed(monkeypatch)
    with pytest.raises(DataError):
        private_shadow_decision(replace(
            candidate, artifact_sha256="f" * 64,
        ), _fixture())
    with pytest.raises(DataError):
        private_shadow_decision(candidate, object())


def test_idempotency_separates_two_source_signatures(monkeypatch):
    _sealed(monkeypatch)
    fixture = _fixture()
    first = entry_idempotency_sha256(
        fixture, m4_future_shadow.FROZEN_MODEL_SHA256,
        "a" * 64, "b" * 64,
    )
    assert len(first) == 64
    assert first != entry_idempotency_sha256(
        fixture, m4_future_shadow.FROZEN_MODEL_SHA256,
        "a" * 64, "c" * 64,
    )
    with pytest.raises(DataError):
        entry_idempotency_sha256(
            fixture, m4_future_shadow.FROZEN_MODEL_SHA256,
            "a" * 64, "a" * 64,
        )


def test_bad_source_team_id_is_rejected_not_fuzzily_remapped():
    docs = _rows()
    docs["2026-11-21"][2]["homeTeam"]["id"] = "untrusted\ninjection"
    with pytest.raises(DataError):
        future_fixtures_from_validated_source(_encode(docs))
