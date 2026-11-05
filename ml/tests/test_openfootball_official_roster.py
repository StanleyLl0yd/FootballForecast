"""Only synthetic source IDs; official public club names are not holdout rows."""
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.locking import _digest
from football_forecast.research.openfootball_crosswalk import (
    OFFICIAL_2025_FINAL_ROSTER,
    OFFICIAL_2025_NEW,
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
    prepare_official_roster_crosswalk,
)

NAMES = TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL
TRAIN = tuple((f"synthetic:2024:{i:02}", name) for i, name in enumerate(sorted(NAMES)))
ALIASES = tuple(sorted(_train_alias(english) for english in NAMES.values()))


def make(**overrides):
    defaults = {"train_source_pairs": TRAIN, "model_team_aliases": ALIASES}
    defaults.update(overrides)
    return prepare_official_roster_crosswalk(**defaults)


def fake_2025_roster():
    known_ids = {name: source_id for source_id, name in TRAIN}
    return tuple(
        (known_ids.get(name, "synthetic:promoted:" +
                       ("baltika" if name == "Балтика" else "sochi")), name)
        for name in OFFICIAL_2025_FINAL_ROSTER
    )


def test_official_roster_precedes_first_match_and_corrects_provisional_torpedo():
    path = Path(__file__).resolve().parents[2] / (
        "docs/M2_OFFICIAL_2025_26_ROSTER_EVIDENCE.json"
    )
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["schemaVersion"] == 1
    assert data["kind"] == "M2_OFFICIAL_2025_26_PRESEASON_ROSTER_GATE"
    assert data["season"] == "2025/2026"
    assert data["firstLeagueKickoffDate"] == "2025-07-18"
    assert data["sourceEvidence"][0]["url"] == "https://www.rfs.ru/news/222586"
    assert data["sourceEvidence"][1]["url"] == "https://www.rfs.ru/news/222692"
    assert data["sourceEvidence"][1]["publicationLocal"] == (
        "2025-07-11T14:02:00+03:00"
    )
    assert tuple(data["finalSourceClubNames"]) == OFFICIAL_2025_FINAL_ROSTER
    assert tuple(data["trainSourceClubNames"]) == tuple(sorted(NAMES))
    assert data["newClubNames"] == ["Балтика", "Сочи"]
    assert data["notReturningClubNames"] == ["Факел", "Химки"]
    assert data["removedBeforeSeason"] == "Торпедо"
    assert data["addedBeforeSeason"] == "Оренбург"
    assert data["retainedClubCount"] == 14
    assert data["privateProviderIdsIncluded"] is False
    assert data["matchResultsOrHoldoutRecordsIncluded"] is False
    assert data["studyLockApproved"] is False
    assert data["holdoutRead"] is False
    live = data["trainOnlyLiveAggregate"]
    assert live["role"] == "2024/2025 train_baseline only"
    assert live["distinctSourceIdNamePairs"] == 16
    assert live["distinctSourceIds"] == 16
    assert live["distinctSourceNames"] == 16
    assert live["unmappedTrainNames"] == 0
    assert live["missingDeclaredTrainNames"] == 0
    assert live["distinctOpenFootballAliases"] == 16
    assert live["modelAliasListSha256"] == _digest(ALIASES)
    assert live["holdoutRowsQueried"] == 0
    assert live["rawProviderIdentifiersOrRowsLogged"] is False
    assert live["mappingApproval"] == "CANDIDATE_ONLY"


def test_training_names_exactly_match_immutable_escrow_alias_fingerprint():
    assert len(NAMES) == len(set(NAMES.values())) == 16
    assert _digest(ALIASES) == (
        "3f10e2bd77f348b570036efc8827f0571a26cae55c7dcb4ad93b5a39710e631b"
    )
    assert len(OFFICIAL_2025_FINAL_ROSTER) == 16
    assert set(OFFICIAL_2025_FINAL_ROSTER) - set(NAMES) == set(OFFICIAL_2025_NEW)
    assert set(OFFICIAL_2025_FINAL_ROSTER) & set(NAMES) == (
        set(NAMES) - {"Факел", "Химки"}
    )


def test_predeclared_mapping_is_deterministic_without_holdout_ids_or_scores():
    first = make()
    second = make(
        train_source_pairs=tuple(reversed(TRAIN)),
        model_team_aliases=tuple(reversed(ALIASES)),
    )
    assert first == second
    receipt = first.public_receipt()
    assert receipt["returningClubs"] == 14
    assert receipt["unseenClubs"] == 2
    assert receipt["trainAliasSetSha256"] == _digest(ALIASES)
    assert receipt["crosswalkSha256"] == first.sha256
    assert receipt["holdoutRead"] is False
    assert receipt["studyLockApproved"] is False
    assert receipt["modelEvaluationApproved"] is False
    assert not any(id_ in str(receipt) for id_, _ in TRAIN)
    with pytest.raises((FrozenInstanceError, AttributeError, TypeError)):
        first.sha256 = "0" * 64


def test_after_lock_roster_metadata_has_exact_14_2_and_unseen_abstention_aliases():
    frozen = make()
    metadata = fake_2025_roster()  # Synthetic stand-in; never opens real 2025/26.
    resolved = frozen.resolve_roster_metadata(metadata)
    assert len(resolved) == 16
    assert len(set(t[0] for t in resolved)) == 16
    assert len(set(t[2] for t in resolved)) == 16
    assert sum(t[2].startswith("S_") for t in resolved) == 14
    assert sum(t[2].startswith("U_") for t in resolved) == 2
    assert resolved == frozen.resolve_roster_metadata(tuple(reversed(metadata)))
    assert all(name in OFFICIAL_2025_NEW for _, name, alias in resolved
               if alias.startswith("U_"))


def test_provisional_roster_or_changed_source_team_id_rejected():
    frozen = make()
    good = list(fake_2025_roster())
    bad = []
    for index, (source_id, name) in enumerate(good):
        if name == "Оренбург":
            copy = list(good)
            copy[index] = ("synthetic:other", "Торпедо")
            bad.append(tuple(copy))
        if name == "Зенит":
            copy = list(good)
            copy[index] = ("synthetic:changed-id", name)
            bad.append(tuple(copy))
        if name == "Балтика":
            copy = list(good)
            copy[index] = (good[0][0], name)
            bad.append(tuple(copy))
            copy = list(good)
            copy[index] = (source_id, "Балтика Москва")
            bad.append(tuple(copy))
    bad.append(tuple(good[:-1]))
    bad.append(tuple([*good[:-1], good[0]]))
    for invalid in bad:
        with pytest.raises(DataError):
            frozen.resolve_roster_metadata(invalid)


def test_bad_train_only_name_alias_and_identifier_fail_closed():
    for invalid in (
        {"train_source_pairs": (*TRAIN[:-1], TRAIN[0])},
        {"train_source_pairs": (*TRAIN[:-1], ("synthetic:bad", "Факел 2"))},
        {"train_source_pairs": (*TRAIN[:-1], ("invalid id", TRAIN[-1][1]))},
        {"train_source_pairs": (*TRAIN[:-1], (TRAIN[-1][0], "Сочи"))},
        {"train_source_pairs": TRAIN[:-1]},
        {"model_team_aliases": (*ALIASES[:-1], "S_" + "F" * 20)},
        {"model_team_aliases": ALIASES[:-1]},
    ):
        with pytest.raises(DataError):
            make(**invalid)
    changed = list(TRAIN)
    changed[0] = ("synthetic:reassigned", changed[0][1])
    assert make(train_source_pairs=tuple(changed)).sha256 != make().sha256
