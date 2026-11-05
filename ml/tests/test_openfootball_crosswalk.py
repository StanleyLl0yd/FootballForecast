"""Synthetic-only pre-holdout club identity crosswalk tests."""
import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.openfootball_crosswalk import (
    _train_alias,
    prepare_train_only_crosswalk,
)

NAMES = tuple(f"Synthetic OpenFootball Club {i:02}" for i in range(16))
TRAIN_IDS = tuple(f"source-2024-{i:02}" for i in range(16))
ROSTER = (*TRAIN_IDS[:13], "source-promoted-A", "source-promoted-B", "source-promoted-C")
MAPPING = dict(zip(TRAIN_IDS, NAMES, strict=True))
MODEL_ALIASES = tuple(sorted(_train_alias(name) for name in NAMES))


def prepare(**overrides):
    args = {
        "train_source_team_ids": TRAIN_IDS,
        "openfootball_2024_names": NAMES,
        "declared_training_correspondence": MAPPING,
        "independent_2025_roster_team_ids": ROSTER,
        "model_team_aliases": MODEL_ALIASES,
    }
    args.update(overrides)
    return prepare_train_only_crosswalk(**args)


def test_reproducible_train_only_crosswalk_and_promoted_club_abstention():
    first = prepare()
    assert prepare() == first
    assert first.sha256 == prepare(
        train_source_team_ids=tuple(reversed(TRAIN_IDS)),
        openfootball_2024_names=tuple(reversed(NAMES)),
        model_team_aliases=tuple(reversed(MODEL_ALIASES)),
        independent_2025_roster_team_ids=tuple(reversed(ROSTER)),
        declared_training_correspondence=dict(reversed(tuple(MAPPING.items()))),
    ).sha256
    for key in TRAIN_IDS[:13]:
        assert first.resolve(key) == _train_alias(MAPPING[key])
    unseen = tuple(first.resolve(key) for key in ROSTER[-3:])
    assert all(alias.startswith("U_") and len(alias) == 22 for alias in unseen)
    assert len(set(unseen)) == 3
    assert len(set(alias for _, alias in first.roster_entries)) == 16
    with pytest.raises(DataError, match="outside predeclared"):
        first.resolve(TRAIN_IDS[15])
    with pytest.raises(DataError, match="outside predeclared"):
        first.resolve("source-unknown")
    receipt = first.public_receipt()
    assert receipt["independentlyApproved"] is False
    assert receipt["studyLockApproved"] is False
    assert receipt["holdoutRead"] is False
    assert receipt["trainingClubCount"] == 16
    assert receipt["rosterClubCount"] == 16
    assert receipt["crosswalkSha256"] == first.sha256
    assert not any(secret in str(receipt) for secret in (*TRAIN_IDS, *ROSTER, *NAMES))
    assert "S_" not in str(receipt) and "U_" not in str(receipt)


def test_changed_predeclared_roster_changes_study_identity():
    original = prepare()
    altered = prepare(independent_2025_roster_team_ids=(
        *ROSTER[:-1], "different-promoted-id",
    ))
    assert altered.sha256 != original.sha256
    assert altered.resolve("different-promoted-id").startswith("U_")
    with pytest.raises(DataError):
        altered.resolve("source-promoted-C")


def test_changed_training_mapping_is_a_different_candidate_not_a_frozen_replay():
    original = prepare()
    swapped = dict(MAPPING)
    swapped[TRAIN_IDS[0]], swapped[TRAIN_IDS[1]] = (
        swapped[TRAIN_IDS[1]], swapped[TRAIN_IDS[0]],
    )
    changed = prepare(declared_training_correspondence=swapped)
    assert changed.sha256 != original.sha256
    assert changed.resolve(TRAIN_IDS[0]) != original.resolve(TRAIN_IDS[0])


def test_corrupt_source_ids_mappings_and_aliases_fail_closed():
    bad_inputs = (
        {"train_source_team_ids": (*TRAIN_IDS[:-1], TRAIN_IDS[0])},
        {"train_source_team_ids": (*TRAIN_IDS[:-1], "bad id")},
        {"train_source_team_ids": (*TRAIN_IDS[:-1], 123)},
        {"openfootball_2024_names": (*NAMES[:-1], NAMES[0])},
        {"openfootball_2024_names": (*NAMES[:-1], " modified ")},
        {"model_team_aliases": (*MODEL_ALIASES[:-1], "S_" + "F" * 20)},
        {"independent_2025_roster_team_ids": (*ROSTER[:-1], ROSTER[0])},
        {"independent_2025_roster_team_ids": (*ROSTER[:-1], "bad id")},
        {"declared_training_correspondence": {**MAPPING, "extra": "bogus"}},
        {"declared_training_correspondence": {
            **MAPPING, TRAIN_IDS[0]: NAMES[1],
        }},
        {"declared_training_correspondence": {
            key: value for key, value in MAPPING.items() if key != TRAIN_IDS[0]
        }},
        {"declared_training_correspondence": {key: key for key in TRAIN_IDS}},
        {"train_source_team_ids": TRAIN_IDS[:-1]},
        {"independent_2025_roster_team_ids": ROSTER[:-1]},
        {"model_team_aliases": MODEL_ALIASES[:-1]},
    )
    for bad in bad_inputs:
        with pytest.raises(DataError):
            prepare(**bad)
    with pytest.raises(DataError):
        prepare().resolve("../unexpected")


def test_crosswalk_is_not_mutable_authorization_or_approved_model():
    crosswalk = prepare()
    with pytest.raises((AttributeError, TypeError)):
        crosswalk.sha256 = "0" * 64
    assert not hasattr(crosswalk, "holdout_scores")
    assert not hasattr(crosswalk, "authorized")
    assert not hasattr(crosswalk, "approve")
