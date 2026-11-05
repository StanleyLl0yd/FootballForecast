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
