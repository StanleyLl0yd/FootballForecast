"""M3 seven-season source-readiness triage, aggregated public evidence only.

This module reads NO database, provider rows, model or holdout. Its caller passes
existing public aggregate evidence maps. It deliberately NEVER grants real
training eligibility: known source-shape facts are not per-fixture attestation.
"""
from dataclasses import dataclass
from typing import Any

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS

STATUS = "BLOCKED_PER_FIXTURE_INDEPENDENT_EVIDENCE_MISSING"
REFERENCE_SEASONS = (
    "2018/19", "2019/20", "2020/21", "2023/24", "2024/25"
)
MISSING_CC0_PATHS = ("2021/22", "2022/23")


@dataclass(frozen=True, slots=True)
class SourceSeasonReadiness:
    season: str
    private_provider_rows: int
    public_cc0_reference_rows: int | None
    public_cc0_explicit_awards: int | None
    public_cc0_rows_without_inline_clock: int | None
    public_cc0_directed_pair_anomalies: int | None
    known_public_revision_sample: bool
    independently_proven_eligible_private_rows: int = 0
    status: str = STATUS


@dataclass(frozen=True, slots=True)
class SourceReadinessReport:
    seasons: tuple[SourceSeasonReadiness, ...]
    total_private_provider_rows: int
    total_public_cc0_reference_rows: int
    confirmed_unplayed_public_cc0_awards: int
    public_cc0_rows_without_inline_clock: int
    public_cc0_directed_pair_anomalies: int
    same_provider_adjacent_club_id_instances: int
    independently_proven_eligible_private_rows: int = 0
    classification: str = "NON_STRICT_RETROSPECTIVE"
    real_training_authorized: bool = False
    private_rows_read: bool = False
    sealed_holdout_read: bool = False


def _obj(value: Any, where: str) -> dict:
    if type(value) is not dict:
        raise DataError(f"M3 readiness: invalid {where}")
    return value


def _list(value: Any, where: str) -> list:
    if type(value) is not list:
        raise DataError(f"M3 readiness: invalid {where}")
    return value


def _integer(value: Any, where: str, *, lower: int = 0, upper: int = 1680) -> int:
    if type(value) is not int or not lower <= value <= upper:
        raise DataError(f"M3 readiness: invalid count for {where}")
    return value


def _must(condition: bool, reason: str) -> None:
    if not condition:
        raise DataError(f"M3 readiness: {reason}")


def summarize_source_readiness(
    private_archive: dict,
    cc0_shape: dict,
    cc0_anomalies: dict,
    identity_sample: dict,
    result_revision: dict,
    source_rights: dict,
) -> SourceReadinessReport:
    """Verify compatible *aggregate* evidence without admitting any private rows.

    A public assertion, even if it says 'approved', cannot create row-level
    provenance. Future independent per-fixture evidence needs a separate,
    reviewed protected adapter and an explicitly revised protocol.
    """
    archive = _obj(private_archive, "private archive")
    shape = _obj(cc0_shape, "CC0 shape")
    anomalies = _obj(cc0_anomalies, "CC0 anomaly")
    identity = _obj(identity_sample, "club identity sample")
    revision = _obj(result_revision, "result revision")
    rights = _obj(source_rights, "source rights")
    _must(
        archive.get("kind") == "M2_PRIVATE_RPL_HISTORY_IMPORT_VERIFIED"
        and shape.get("kind") == "M2_INDEPENDENT_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_OBSERVATION"
        and anomalies.get("kind") == "M2_INDEPENDENT_CC0_RPL_ANOMALY_CORROBORATION"
        and identity.get("kind") == "M2_RPL_SEVEN_SEASON_TEAM_IDENTITY_SAMPLE"
        and revision.get("kind") == "M2_PUBLIC_RPL_RESULT_REVISION_CROSSCHECK"
        and rights.get("kind") == "M2_PUBLIC_HISTORICAL_SOURCE_RIGHTS_REVIEW",
        "unexpected provenance evidence kind",
    )

    db = _obj(archive.get("databaseVerification"), "private archive summary")
    receipt = _obj(_obj(archive.get("run"), "run").get("importReceipt"), "receipt")
    _must(
        db.get("seasons") == list(DEVELOPMENT_SEASONS)
        and _integer(db.get("snapshotCount"), "snapshot count") == 7
        and _integer(db.get("matchesPerSeason"), "per-season count") == 240
        and _integer(db.get("matchCount"), "private archive rows") == 1680
        and _integer(db.get("validFinalScores"), "provider final scores") == 1680
        and _integer(db.get("directedPairs"), "private directed pairs") == 1680
        and receipt.get("sourceOnly") is True
        and receipt.get("holdoutRead") is False
        and receipt.get("modelTrainingApproved") is False
        and receipt.get("publicRecordsWritten") == 0
        and db.get("sealedHoldoutRead") is False
        and db.get("publicForecastCount") == 0,
        "provider archive is not the original bounded source-only cohort",
    )
    _must(
        _obj(archive.get("limitations"), "archive limitations").get(
            "originalPublisherHistoricalAsOfVerified"
        ) is False,
        "archive historical as-of status unexpectedly changed",
    )

    refs = _list(shape.get("developmentSeasonsObserved"), "public CC0 seasons")
    _must(len(refs) == len(REFERENCE_SEASONS), "unexpected public reference season count")
    cc0_by_year = {}
    for raw in refs:
        item = _obj(raw, "public CC0 season")
        season = item.get("season")
        _must(season in REFERENCE_SEASONS and season not in cc0_by_year,
              "duplicate, missing or sealed public reference season")
        _must(
            _integer(item.get("structuralMatchRows"), "public structural rows") == 240
            and _integer(item.get("notProvenPlayedRows"), "not-proven played rows") == 240
            and _integer(item.get("structurallyValidFullTimePairs"), "public final scores")
            == 240,
            "public source shape no longer matches bounded reference",
        )
        directed = _integer(item.get("uniqueDirectedPairs"), "directed reference pairs")
        _must(directed == (239 if season == "2023/24" else 240),
              "public directed-pair anomaly not preserved")
        cc0_by_year[season] = item
    _must(
        set(cc0_by_year) == set(REFERENCE_SEASONS)
        and shape.get("unavailableInCheckedCc0RplPaths") == list(MISSING_CC0_PATHS)
        and _obj(shape.get("limitations"), "public shape limitations").get(
            "sourceMatchIdentityCrosswalkApproved"
        ) is False,
        "missing CC0 paths or private crosswalk have been misrepresented",
    )

    awarded = _obj(anomalies.get("awarded"), "awarded matches")
    awards_by_year = {}
    for entry in _list(awarded.get("bySeason"), "award seasons"):
        item = _obj(entry, "award season")
        season = item.get("season")
        _must(season in ("2019/20", "2020/21") and season not in awards_by_year,
              "unexpected award season")
        count = _integer(item.get("declaredAwardedRows"), "awarded rows", upper=240)
        _must(
            count == _integer(item.get("notPlayedCorroboratedRows"), "corroborated awards",
                              upper=240)
            and len(_list(item.get("observations"), "award observations")) == count,
            "not all declared technical results independently corroborated",
        )
        awards_by_year[season] = count
    _must(
        awards_by_year == {"2019/20": 4, "2020/21": 2}
        and _integer(awarded.get("independentlyCorroboratedAsNotPlayed"), "public awards")
        == 6
        and awarded.get("eligibleAsPlayedGoals") is False,
        "public technical results must not be used as played goals",
    )
    for season, count in awards_by_year.items():
        _must(cc0_by_year[season].get("explicitAwardedStatusRows") == count,
              "archive and anomaly award counts conflict")
    swap = _obj(anomalies.get("scheduleSwap"), "schedule anomaly")
    _must(
        swap.get("season") == "2023/24"
        and swap.get("duplicateDirectedPairs") == 1
        and swap.get("missingDirectedPairs") == 1
        and swap.get("automaticArchiveCorrectionPermitted") is False
        and cc0_by_year["2023/24"].get("directedPairDuplicateCount") == 1,
        "public home/away reversal must remain uncorrected and flagged",
    )

    sample = _list(identity.get("perSeason"), "identity sample seasons")
    _must(len(sample) == 7 and identity.get("observedUniqueClubIds") == 26,
          "identity sample shape changed")
    _must(
        [item.get("season") for item in sample if type(item) is dict]
        == list(DEVELOPMENT_SEASONS)
        and all(item.get("firstPageRows") == 50 and item.get("clubIds") == 16
                for item in sample),
        "club sample cannot establish full independent identity",
    )
    overlaps = _list(identity.get("consecutiveOverlaps"), "adjacent club ID overlaps")
    _must(len(overlaps) == 6, "missing adjacent club ID observations")
    shared = 0
    for i, item in enumerate(overlaps):
        o = _obj(item, "adjacent overlap")
        value = _integer(o.get("sharedIds"), "same-provider adjacent IDs", upper=16)
        _must(
            o.get("earlierSeason") == DEVELOPMENT_SEASONS[i]
            and o.get("laterSeason") == DEVELOPMENT_SEASONS[i + 1]
            and o.get("sameNormalizedDisplayName") == value
            and o.get("pinnedPrivateOverlapMatches") is True,
            "identity overlap is not independently cross-provider certified",
        )
        shared += value
    _must(
        shared == 82
        and identity.get("totalSharedAdjacentClubIdInstances") == 82
        and _obj(identity.get("limitations"), "identity limitations").get(
            "independentClubIdentityMappingAccepted"
        ) is False,
        "provider overlap is not official club-identity verification",
    )

    rev = _obj(revision.get("sample"), "revised public match")
    _must(
        rev.get("season") == "2022/23"
        and rev.get("fieldMatchPlayed") is True
        and rev.get("originalFieldResultLaterAnnulled") is True
        and rev.get("technicalResultDifferent") is True
        and rev.get("matchSpecificCrossSourceIdentityReviewed") is False,
        "historical official-table score must not replace on-field goals",
    )
    _must(
        _obj(rights.get("gates"), "rights gates").get(
            "originalSourceRightsForAutomaticTrainingVerified"
        ) is False
        and _obj(rights.get("gates"), "rights gates").get(
            "privateMatchIdentityCrosswalkApproved"
        ) is False,
        "historical source rights or crosswalk not independently approved",
    )

    reports = []
    for season in DEVELOPMENT_SEASONS:
        ref = cc0_by_year.get(season)
        awards = ref.get("explicitAwardedStatusRows") if ref is not None else None
        if awards is not None:
            _integer(awards, "CC0 explicit awards", upper=240)
        clock_missing = ref.get("rowsWithoutExplicitClockTime") if ref is not None else None
        if clock_missing is not None:
            _integer(clock_missing, "public missing inline clock", upper=240)
        reports.append(SourceSeasonReadiness(
            season=season,
            private_provider_rows=240,
            public_cc0_reference_rows=ref["structuralMatchRows"] if ref else None,
            public_cc0_explicit_awards=awards,
            public_cc0_rows_without_inline_clock=clock_missing,
            public_cc0_directed_pair_anomalies=(
                1 if season == "2023/24" else 0 if ref else None
            ),
            known_public_revision_sample=season == "2022/23",
        ))

    missing_clock = sum(
        r.public_cc0_rows_without_inline_clock or 0 for r in reports
    )
    _must(missing_clock == 47, "unexpected aggregate of missing inline clock fields")
    return SourceReadinessReport(
        seasons=tuple(reports),
        total_private_provider_rows=1680,
        total_public_cc0_reference_rows=1200,
        confirmed_unplayed_public_cc0_awards=6,
        public_cc0_rows_without_inline_clock=missing_clock,
        public_cc0_directed_pair_anomalies=1,
        same_provider_adjacent_club_id_instances=shared,
    )
