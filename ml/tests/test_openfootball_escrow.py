"""Synthetic-only OpenFootball escrow: never creates a real model artifact."""
import json
from dataclasses import replace
from hashlib import sha256

import pytest

from test_openfootball_training import fixture_doc
from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import PROTOCOL as CALENDAR_PROTOCOL
from football_forecast.data.openfootball_training import read_openfootball_calendar_training
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.openfootball_train import produce_openfootball_train_candidate
from football_forecast.research.model_escrow import (
    load_private_model, serialize_private_model,
)


@pytest.fixture(scope="module")
def frozen_calendar():
    document = fixture_doc()
    fixtures, _ = read_openfootball_calendar_training(document)
    model = fit_independent_poisson(fixtures)
    receipt = produce_openfootball_train_candidate(document, code_sha="b" * 40)
    return model, receipt


def sha(data: bytes) -> str:
    return sha256(data).hexdigest()


def test_calendar_model_matches_existing_unapproved_train_fingerprint(frozen_calendar):
    model, receipt = frozen_calendar
    payload = serialize_private_model(model, protocol=CALENDAR_PROTOCOL)
    assert payload == serialize_private_model(model, protocol=CALENDAR_PROTOCOL)
    assert len(payload) <= 8192
    assert json.loads(payload)["protocol"] == CALENDAR_PROTOCOL
    assert load_private_model(
        payload, expected_protocol=CALENDAR_PROTOCOL,
        artifact_sha256=sha(payload),
        fitted_model_sha256=receipt["fittedModelSha256"],
    ) == model
    assert b"2025/2026" not in payload
    assert b"kickoff" not in payload.lower()
    assert b"holdout" not in payload.lower()


def test_legacy_and_calendar_protocols_are_not_interchangeable(frozen_calendar):
    model, receipt = frozen_calendar
    calendar_payload = serialize_private_model(model, protocol=CALENDAR_PROTOCOL)
    with pytest.raises(DataError, match="closed schema"):
        load_private_model(
            calendar_payload, artifact_sha256=sha(calendar_payload),
            fitted_model_sha256=receipt["fittedModelSha256"],
        )
    legacy_payload = serialize_private_model(model)
    with pytest.raises(DataError, match="closed schema"):
        load_private_model(
            legacy_payload, expected_protocol=CALENDAR_PROTOCOL,
            artifact_sha256=sha(legacy_payload),
            fitted_model_sha256=receipt["fittedModelSha256"],
        )
    for bad in ("random", "", "m2-openfootball-calendar-v2", None):
        with pytest.raises(DataError, match="unsupported research protocol"):
            serialize_private_model(model, protocol=bad)
        with pytest.raises(DataError, match="unsupported research protocol"):
            load_private_model(
                calendar_payload, expected_protocol=bad,
                artifact_sha256=sha(calendar_payload),
                fitted_model_sha256=receipt["fittedModelSha256"],
            )


def test_changed_private_model_cannot_reuse_pinned_calendar_digest(frozen_calendar):
    model, receipt = frozen_calendar
    payload = serialize_private_model(model, protocol=CALENDAR_PROTOCOL)
    changed = serialize_private_model(
        replace(model, intercept=model.intercept + 0.01),
        protocol=CALENDAR_PROTOCOL,
    )
    with pytest.raises(DataError, match="model digest"):
        load_private_model(
            changed, expected_protocol=CALENDAR_PROTOCOL,
            artifact_sha256=sha(changed),
            fitted_model_sha256=receipt["fittedModelSha256"],
        )
    with pytest.raises(DataError, match="artifact identity"):
        load_private_model(
            payload, expected_protocol=CALENDAR_PROTOCOL,
            artifact_sha256=sha(changed),
            fitted_model_sha256=receipt["fittedModelSha256"],
        )


def test_calendar_codec_rejects_bogus_scope_or_extra_private_fields(frozen_calendar):
    model, receipt = frozen_calendar
    for invalid in (
        replace(model, training_matches=239),
        replace(model, appearances=(0,) + model.appearances[1:]),
        replace(model, teams=("raw-club",) + model.teams[1:]),
    ):
        with pytest.raises(DataError):
            serialize_private_model(invalid, protocol=CALENDAR_PROTOCOL)
    payload = serialize_private_model(model, protocol=CALENDAR_PROTOCOL)
    parsed = json.loads(payload)
    parsed["holdoutRead"] = True
    tampered = (json.dumps(parsed, sort_keys=True, separators=(",", ":")) + "\n").encode()
    with pytest.raises(DataError, match="closed schema"):
        load_private_model(
            tampered, expected_protocol=CALENDAR_PROTOCOL,
            artifact_sha256=sha(tampered),
            fitted_model_sha256=receipt["fittedModelSha256"],
        )
