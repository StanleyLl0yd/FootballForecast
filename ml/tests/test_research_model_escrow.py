"""Synthetic train-only escrow round trips; never reads production or holdout."""
import json
from dataclasses import replace
from hashlib import sha256

import pytest
from test_research_lock import SHA, SNAPSHOT, SyntheticCursor, rows

from football_forecast.data.contracts import DataError
from football_forecast.data.training_input import read_training_input
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.locking import _model_fingerprint
from football_forecast.research.model_escrow import (
    load_private_model,
    serialize_private_model,
)
from football_forecast.research.runner import training_only_mapping


@pytest.fixture(scope="module")
def synthetic_model():
    training = read_training_input(
        SyntheticCursor(rows()), snapshot_id=SNAPSHOT, source_sha256=SHA,
    )
    names = {name for fixture in training.fixtures
             for name in (fixture.home_team_id, fixture.away_team_id)}
    aliases = training_only_mapping(names)
    fixtures = tuple(replace(
        item,
        home_team_id=aliases[item.home_team_id],
        away_team_id=aliases[item.away_team_id],
    ) for item in training.fixtures)
    return fit_independent_poisson(fixtures)


def _sha(payload):
    return sha256(payload).hexdigest()


def _load(payload, model, **overrides):
    return load_private_model(
        payload,
        artifact_sha256=overrides.get("artifact_sha256", _sha(payload)),
        fitted_model_sha256=overrides.get("fitted_model_sha256", _model_fingerprint(model)),
    )


def _mutate(payload, **changes):
    content = json.loads(payload)
    content.update(changes)
    return (json.dumps(
        content, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
    ) + "\n").encode("ascii")


def test_canonical_private_round_trip_is_deterministic_and_fingerprint_bound(synthetic_model):
    payload = serialize_private_model(synthetic_model)
    assert payload == serialize_private_model(synthetic_model)
    assert len(payload) < 8192
    assert load_private_model(
        payload,
        artifact_sha256=_sha(payload),
        fitted_model_sha256=_model_fingerprint(synthetic_model),
    ) == synthetic_model
    assert "synthetic-" not in payload.decode("ascii")
    assert "src-" not in payload.decode("ascii")
    assert b"sealed_holdout" not in payload
    assert b"2025/2026" not in payload


def test_wrong_artifact_or_model_digest_refused(synthetic_model):
    payload = serialize_private_model(synthetic_model)
    with pytest.raises(DataError, match="artifact identity"):
        _load(payload, synthetic_model, artifact_sha256="f" * 64)
    with pytest.raises(DataError, match="model digest"):
        _load(payload, synthetic_model, fitted_model_sha256="a" * 64)
    with pytest.raises(DataError, match="artifact identity"):
        _load(payload, synthetic_model, artifact_sha256="not a hash")
    with pytest.raises(DataError, match="artifact identity"):
        _load(payload.decode("ascii"), synthetic_model)


def test_schema_and_noncanonical_bytes_refused(synthetic_model):
    payload = serialize_private_model(synthetic_model)
    for bad in (
        _mutate(payload, privateRows=[]),
        _mutate(payload, protocol="not-the-frozen-protocol"),
        _mutate(payload, holdoutAccessAuthorized=True),
        _mutate(payload, appearances=[True] + [30] * 15),
        payload.rstrip(b"\n"),
        payload + b"\n",
    ):
        with pytest.raises(DataError):
            _load(bad, synthetic_model)


def test_coefficients_cannot_be_changed_or_made_nonfinite(synthetic_model):
    payload = serialize_private_model(synthetic_model)
    content = json.loads(payload)
    content["intercept"] = "nan"
    with pytest.raises(DataError, match="coefficient"):
        _load(_mutate(payload, **content), synthetic_model)

    content = json.loads(payload)
    content["intercept"] = "0x1.0p+0"
    with pytest.raises(DataError, match="model digest"):
        _load(_mutate(payload, **content), synthetic_model)

    content = json.loads(payload)
    content["attack"][0] = "0x1.00p+0"
    with pytest.raises(DataError, match="noncanonical"):
        _load(_mutate(payload, **content), synthetic_model)


def test_invalid_private_model_cannot_be_serialized(synthetic_model):
    for invalid in (
        replace(synthetic_model, teams=("raw-club",) + synthetic_model.teams[1:]),
        replace(synthetic_model, appearances=(0,) + synthetic_model.appearances[1:]),
        replace(synthetic_model, training_matches=239),
        replace(synthetic_model, home_advantage=float("nan")),
    ):
        with pytest.raises(DataError):
            serialize_private_model(invalid)
