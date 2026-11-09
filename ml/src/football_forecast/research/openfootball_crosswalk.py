"""Private, deterministic M2 crosswalk derived before sealed holdout scoring.

No I/O, 2025/26 fixture/result inspection, training, source downloads, or SQL.
The caller must prove that input IDs and roster are from independent metadata
and that the correspondence was frozen without consulting heldout labels.
A digest is only a candidate and is NOT a trusted study-lock authorization.
"""
from collections.abc import Mapping
from dataclasses import dataclass
from hashlib import sha256
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import PROTOCOL
from football_forecast.research.locking import _digest

_ID = r"[A-Za-z0-9_.:-]{1,100}"
_ALIAS = r"(?:S|U)_[A-F0-9]{20}"
_POLICY = "training-2024-exact-declared-map;unknown-roster-member-abstain-v1"


def _source_id(value: object) -> str:
    if type(value) is not str or fullmatch(_ID, value) is None:
        raise DataError("M2 crosswalk: unverified source-team identifier")
    return value


def _train_alias(name: str) -> str:
    return "S_" + sha256(
        ("openfootball-2024-club:" + name).encode("utf-8")
    ).hexdigest()[:20].upper()


def _unseen_alias(source_id: str) -> str:
    return "U_" + sha256(
        ("m2-2025-roster-unseen:" + source_id).encode("utf-8")
    ).hexdigest()[:20].upper()


@dataclass(frozen=True, slots=True)
class FrozenTrainCrosswalk:
    """Private mappings, public-safe digest; never expose entries to a browser."""
    train_entries: tuple[tuple[str, str], ...]
    roster_entries: tuple[tuple[str, str], ...]
    sha256: str

    def resolve(self, source_team_id: str) -> str:
        """Refuse all source IDs absent from the independently frozen roster."""
        wanted = _source_id(source_team_id)
        for provider_id, alias in self.roster_entries:
            if provider_id == wanted:
                return alias
        raise DataError("M2 crosswalk: team outside predeclared 2025/26 roster")

    def public_receipt(self) -> dict[str, object]:
        """Never return source IDs, names, aliases or any heldout records."""
        return {
            "schemaVersion": 1,
            "kind": "M2_TRAIN_ONLY_CLUB_CROSSWALK_CANDIDATE",
            "protocol": PROTOCOL,
            "trainingClubCount": len(self.train_entries),
            "rosterClubCount": len(self.roster_entries),
            "crosswalkSha256": self.sha256,
            "derivedWithoutHeldoutResults": True,
            "holdoutRead": False,
            "independentlyApproved": False,
            "studyLockApproved": False,
        }


def prepare_train_only_crosswalk(
    *,
    train_source_team_ids: tuple[str, ...],
    openfootball_2024_names: tuple[str, ...],
    declared_training_correspondence: Mapping[str, str],
    independent_2025_roster_team_ids: tuple[str, ...],
    model_team_aliases: tuple[str, ...],
) -> FrozenTrainCrosswalk:
    """Require exactly 16 previously known train IDs, names, model aliases.

    The roster list must be captured separately, independent of match RESULTS.
    The caller MUST source-verify both 2024 team lists and the earlier roster,
    review manual correspondence and anchor this digest before any label read.
    """
    if (type(train_source_team_ids) is not tuple
            or type(openfootball_2024_names) is not tuple
            or type(independent_2025_roster_team_ids) is not tuple
            or type(model_team_aliases) is not tuple
            or any(len(values) != 16 for values in (
                train_source_team_ids, openfootball_2024_names,
                independent_2025_roster_team_ids, model_team_aliases,
            ))):
        raise DataError("M2 crosswalk: complete 16-club inputs required")
    train_ids = tuple(_source_id(value) for value in train_source_team_ids)
    roster_ids = tuple(_source_id(value) for value in independent_2025_roster_team_ids)
    names = openfootball_2024_names
    if (len(set(train_ids)) != 16 or len(set(roster_ids)) != 16
            or any(type(name) is not str or not 1 <= len(name) <= 120
                   or not name.strip() or name.strip() != name
                   or any(ord(ch) < 32 for ch in name)
                   for name in names)
            or len(set(names)) != 16
            or any(type(alias) is not str or fullmatch(r"S_[A-F0-9]{20}", alias) is None
                   for alias in model_team_aliases)
            or len(set(model_team_aliases)) != 16):
        raise DataError("M2 crosswalk: duplicates or invalid training identities")
    aliases = {_train_alias(name) for name in names}
    if aliases != set(model_team_aliases) or len(aliases) != 16:
        raise DataError("M2 crosswalk: 2024 names differ from locked model aliases")
    if (not isinstance(declared_training_correspondence, Mapping)
            or set(declared_training_correspondence) != set(train_ids)
            or any(type(name) is not str or name not in names
                   for name in declared_training_correspondence.values())
            or set(declared_training_correspondence.values()) != set(names)):
        raise DataError("M2 crosswalk: train-only club correspondence is not bijective")
    train_entries = tuple(sorted(
        (source_id, _train_alias(declared_training_correspondence[source_id]))
        for source_id in train_ids
    ))
    known = dict(train_entries)
    roster_entries = tuple(sorted(
        (source_id, known.get(source_id, _unseen_alias(source_id)))
        for source_id in roster_ids
    ))
    if (len({alias for _, alias in roster_entries}) != 16
            or any(fullmatch(_ALIAS, alias) is None for _, alias in roster_entries)):
        raise DataError("M2 crosswalk: holdout roster alias collision")
    commitment = _digest({
        "schemaVersion": 1,
        "protocol": PROTOCOL,
        "trainingEntries": train_entries,
        "rosterEntries": roster_entries,
        "unknownPolicy": _POLICY,
    })
    return FrozenTrainCrosswalk(train_entries, roster_entries, commitment)


# Names are public preseason facts, never provider IDs or heldout match records.
# The two dated official RFU decisions and final names are separately recorded in
# docs/M2_OFFICIAL_2025_26_ROSTER_EVIDENCE.json. Torpedo was replaced by
# Orenburg BEFORE the first 2025/26 match, so the provisional roster is invalid.
TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL = {
    "Акрон": "Akron Tolyatti",
    "Ахмат": "Akhmat Grozny",
    "Динамо Махачкала": "FK Dinamo Makhachkala",
    "Динамо Москва": "Dinamo Moskva",
    "Зенит": "Zenit St. Petersburg",
    "Краснодар": "FK Krasnodar",
    "Крылья Советов": "Krylia Sovetov",
    "Локомотив": "Lokomotiv Moskva",
    "Оренбург": "FK Orenburg",
    "Пари НН": "FK Nizhny Novgorod",
    "Ростов": "FK Rostov",
    "Рубин": "Rubin Kazan",
    "Спартак": "Spartak Moskva",
    "Факел": "Fakel Voronezh",
    "Химки": "FK Khimki",
    "ЦСКА": "CSKA Moskva",
}
OFFICIAL_2025_FINAL_ROSTER = tuple(sorted((
    "Акрон", "Ахмат", "Балтика", "Динамо Махачкала", "Динамо Москва",
    "Зенит", "Краснодар", "Крылья Советов", "Локомотив",
    "Оренбург", "Пари НН", "Ростов", "Рубин", "Сочи", "Спартак", "ЦСКА",
)))
OFFICIAL_2025_NEW = ("Балтика", "Сочи")
_PINNED_TRAIN_MODEL_ALIAS_SHA = (
    "3f10e2bd77f348b570036efc8827f0571a26cae55c7dcb4ad93b5a39710e631b"
)
_OFFICIAL_ROSTER_POLICY = "rfs-2025-07-11-exact-name-incumbent-id-promoted-abstain-v1"


@dataclass(frozen=True, slots=True)
class FrozenOfficialRosterCrosswalk:
    """Private 2024 metadata and public 2025 roster, fixed BEFORE heldout reads.

    The unknown promoted provider IDs are not invented: after a study lock,
    the worker must verify that the source's exact names match the official
    roster, and that returning clubs still use their known 2024 source IDs.
    No 2025/26 ID, result or match time is used to construct this digest.
    """
    training_entries: tuple[tuple[str, str, str], ...]
    sha256: str

    def public_receipt(self) -> dict[str, object]:
        return {
            "schemaVersion": 1,
            "kind": "M2_OFFICIAL_PRESEASON_ROSTER_CROSSWALK_CANDIDATE",
            "protocol": PROTOCOL,
            "trainClubs": 16,
            "returningClubs": 14,
            "unseenClubs": 2,
            "sourceRosterRevision": "2025-07-11",
            "trainAliasSetSha256": _PINNED_TRAIN_MODEL_ALIAS_SHA,
            "crosswalkSha256": self.sha256,
            "privateProviderIdsIncluded": False,
            "holdoutRead": False,
            "studyLockApproved": False,
            "modelEvaluationApproved": False,
        }

    def resolve_roster_metadata(
        self, source_pairs: tuple[tuple[str, str], ...],
    ) -> tuple[tuple[str, str, str], ...]:
        """Only for a LATER approved one-use worker; no scores are accepted.

        Validate complete source metadata after authenticating a pre-holdout
        lock. Unexpected/renamed teams or reused IDs reject the entire set.
        The returned private tuples are NOT public receipts.
        """
        if type(source_pairs) is not tuple or len(source_pairs) != 16:
            raise DataError("M2 official roster: expected 16 source identity pairs")
        incumbents = {
            name: (source_id, alias)
            for source_id, name, alias in self.training_entries
        }
        incumbent_ids = {entry[0] for entry in self.training_entries}
        unique_ids: set[str] = set()
        unique_names: set[str] = set()
        resolved: list[tuple[str, str, str]] = []
        for pair in source_pairs:
            if (type(pair) is not tuple or len(pair) != 2
                    or type(pair[1]) is not str):
                raise DataError("M2 official roster: invalid provider team metadata")
            source_id, name = _source_id(pair[0]), pair[1]
            if (source_id in unique_ids or name in unique_names
                    or name not in OFFICIAL_2025_FINAL_ROSTER):
                raise DataError("M2 official roster: duplicate or unexpected club")
            unique_ids.add(source_id)
            unique_names.add(name)
            if name in incumbents:
                expected_id, alias = incumbents[name]
                if source_id != expected_id:
                    raise DataError("M2 official roster: incumbent source ID drift")
            elif name in OFFICIAL_2025_NEW and source_id not in incumbent_ids:
                alias = _unseen_alias("official-2025-26:" + name)
            else:
                raise DataError("M2 official roster: unapproved promoted club identity")
            resolved.append((source_id, name, alias))
        if (unique_names != set(OFFICIAL_2025_FINAL_ROSTER)
                or len({entry[2] for entry in resolved}) != 16):
            raise DataError("M2 official roster: incomplete or colliding identities")
        return tuple(sorted(resolved))


def prepare_official_roster_crosswalk(
    *, train_source_pairs: tuple[tuple[str, str], ...],
    model_team_aliases: tuple[str, ...],
) -> FrozenOfficialRosterCrosswalk:
    """No heldout data: construct the real-name candidate from 2024 TRAIN only.

    Caller must independently verify 2024 source identity/bytes, the manual
    16-name correspondence, the RFU dated revision and the stored model escrow
    BEFORE claiming a protected lock. This function does not make that claim.
    """
    names = TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL
    if (type(train_source_pairs) is not tuple or len(train_source_pairs) != 16
            or type(model_team_aliases) is not tuple
            or len(model_team_aliases) != 16):
        raise DataError("M2 official crosswalk: incomplete train-only input")
    if (len(set(names)) != 16 or len(set(names.values())) != 16
            or set(OFFICIAL_2025_FINAL_ROSTER) - set(names) != set(OFFICIAL_2025_NEW)
            or len(set(OFFICIAL_2025_FINAL_ROSTER) & set(names)) != 14):
        raise DataError("M2 official crosswalk: invalid reviewed roster policy")
    frozen_aliases = tuple(sorted(_train_alias(value) for value in names.values()))
    if (_digest(frozen_aliases) != _PINNED_TRAIN_MODEL_ALIAS_SHA
            or tuple(sorted(model_team_aliases)) != frozen_aliases):
        raise DataError("M2 official crosswalk: model alias set mismatch")
    source_ids: set[str] = set()
    source_names: set[str] = set()
    entries: list[tuple[str, str, str]] = []
    for pair in train_source_pairs:
        if (type(pair) is not tuple or len(pair) != 2
                or type(pair[1]) is not str):
            raise DataError("M2 official crosswalk: invalid train identity pair")
        source_id, name = _source_id(pair[0]), pair[1]
        if (source_id in source_ids or name in source_names or name not in names):
            raise DataError("M2 official crosswalk: unknown or duplicate train club")
        source_ids.add(source_id)
        source_names.add(name)
        entries.append((source_id, name, _train_alias(names[name])))
    if source_names != set(names):
        raise DataError("M2 official crosswalk: incomplete 2024 team roster")
    train_entries = tuple(sorted(entries))
    return FrozenOfficialRosterCrosswalk(
        training_entries=train_entries,
        sha256=_digest({
            "schemaVersion": 1,
            "protocol": PROTOCOL,
            "policy": _OFFICIAL_ROSTER_POLICY,
            "sourceEvidence": [
                "https://www.rfs.ru/news/222586",
                "https://www.rfs.ru/news/222692",
            ],
            "trainingEntries": train_entries,
            "officialFinalRoster": OFFICIAL_2025_FINAL_ROSTER,
            "unseenOfficialNames": OFFICIAL_2025_NEW,
            "modelAliasSetSha256": _PINNED_TRAIN_MODEL_ALIAS_SHA,
        }),
    )
