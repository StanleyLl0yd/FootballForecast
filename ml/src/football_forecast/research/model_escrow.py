"""Private, in-memory M2 model escrow codec; no persistence or holdout access.

These bytes contain fitted coefficients and MUST NOT enter Git, public artifacts,
browser responses, job summaries or logs. A matching digest is not approval.
"""
import json
from hashlib import sha256
from math import isfinite
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.models.team_strength import TeamStrengthModel
from football_forecast.research.locking import PROTOCOL, _model_fingerprint

_MAX_BYTES = 8192
_FIELDS = {
    "schemaVersion", "kind", "protocol", "teams", "attack", "defence",
    "appearances", "intercept", "homeAdvantage", "trainingMatches",
}
_SHA = r"[a-f0-9]{64}"


def _checked_model(model: TeamStrengthModel) -> None:
    if type(model) is not TeamStrengthModel:
        raise DataError("M2 private model: invalid object")
    teams = model.teams
    if (type(teams) is not tuple or len(teams) != 16
            or teams != tuple(sorted(teams)) or len(set(teams)) != 16
            or any(type(t) is not str or not fullmatch(r"S_[A-F0-9]{20}", t)
                   for t in teams)):
        raise DataError("M2 private model: invalid training-only aliases")
    if (type(model.training_matches) is not int or model.training_matches != 240
            or type(model.appearances) is not tuple
            or len(model.appearances) != 16
            or any(type(n) is not int or n != 30 for n in model.appearances)):
        raise DataError("M2 private model: invalid train-season coverage")
    for values in (model.attack, model.defence):
        if (type(values) is not tuple or len(values) != 16
                or any(type(n) is not float or not isfinite(n) or abs(n) > 20
                       for n in values)):
            raise DataError("M2 private model: invalid team coefficients")
    if (type(model.intercept) is not float or not isfinite(model.intercept)
            or abs(model.intercept) > 20
            or type(model.home_advantage) is not float
            or not isfinite(model.home_advantage)
            or abs(model.home_advantage) > 20):
        raise DataError("M2 private model: invalid global coefficients")


def serialize_private_model(model: TeamStrengthModel) -> bytes:
    """Return canonical, private coefficient bytes; caller must secure them."""
    _checked_model(model)
    content = {
        "schemaVersion": 1,
        "kind": "M2_PRIVATE_FIXED_POISSON_MODEL",
        "protocol": PROTOCOL,
        "teams": list(model.teams),
        "attack": [n.hex() for n in model.attack],
        "defence": [n.hex() for n in model.defence],
        "appearances": list(model.appearances),
        "intercept": model.intercept.hex(),
        "homeAdvantage": model.home_advantage.hex(),
        "trainingMatches": model.training_matches,
    }
    encoded = (json.dumps(
        content, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
        allow_nan=False,
    ) + "\n").encode("ascii")
    if len(encoded) > _MAX_BYTES:
        raise DataError("M2 private model: artifact exceeds byte limit")
    return encoded


def _canonical_float(value: object) -> float:
    if not isinstance(value, str) or len(value) > 32:
        raise DataError("M2 private model: invalid hexadecimal coefficient")
    try:
        number = float.fromhex(value)
    except ValueError as exc:
        raise DataError("M2 private model: invalid hexadecimal coefficient") from exc
    if not isfinite(number) or number.hex() != value:
        raise DataError("M2 private model: noncanonical coefficient")
    return number


def load_private_model(
    payload: bytes, *, artifact_sha256: str, fitted_model_sha256: str,
) -> TeamStrengthModel:
    """Verify exact private bytes and existing fitted-model fingerprint.

    Neither a caller-provided digest nor the returned model authorizes a study.
    The trusted worker must independently authenticate both digests against
    its previously accepted protected pre-holdout record.
    """
    if (type(payload) is not bytes or not 0 < len(payload) <= _MAX_BYTES
            or not isinstance(artifact_sha256, str)
            or not fullmatch(_SHA, artifact_sha256)
            or not isinstance(fitted_model_sha256, str)
            or not fullmatch(_SHA, fitted_model_sha256)
            or sha256(payload).hexdigest() != artifact_sha256):
        raise DataError("M2 private model: unverified artifact identity")
    try:
        data = json.loads(payload.decode("ascii"))
    except (ValueError, UnicodeError) as exc:
        raise DataError("M2 private model: invalid JSON") from exc
    if (type(data) is not dict or set(data) != _FIELDS
            or type(data["schemaVersion"]) is not int or data["schemaVersion"] != 1
            or data["kind"] != "M2_PRIVATE_FIXED_POISSON_MODEL"
            or data["protocol"] != PROTOCOL
            or any(type(data[key]) is not list or len(data[key]) != 16
                   for key in ("teams", "attack", "defence", "appearances"))):
        raise DataError("M2 private model: invalid closed schema")
    try:
        model = TeamStrengthModel(
            teams=tuple(data["teams"]),
            attack=tuple(_canonical_float(v) for v in data["attack"]),
            defence=tuple(_canonical_float(v) for v in data["defence"]),
            appearances=tuple(data["appearances"]),
            intercept=_canonical_float(data["intercept"]),
            home_advantage=_canonical_float(data["homeAdvantage"]),
            training_matches=data["trainingMatches"],
        )
        _checked_model(model)
        if (serialize_private_model(model) != payload
                or _model_fingerprint(model) != fitted_model_sha256):
            raise DataError("M2 private model: model digest or encoding mismatch")
    except DataError:
        raise
    except (TypeError, KeyError, ValueError) as exc:
        raise DataError("M2 private model: invalid coefficient data") from exc
    return model
