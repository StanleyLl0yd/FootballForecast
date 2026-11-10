"""Fail-closed RFS anchors for the two missing CC0 development seasons.

This module never queries private sources. RFS current calendars are
retrospective, not original published UTC or verified on-field goal labels.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from football_forecast.data.contracts import DataError

KIND = "M3_TWO_MISSING_CC0_SEASONS_SIX_OFFICIAL_RFS_AGGREGATE_ANCHORS"
SCOPE = "ONLY_2021_22_AND_2022_23_PRIVATE_SELECT_SIX_RETROSPECTIVE_OFFICIAL_ANCHORS"
CALENDARS = {
    "2021/22": "https://www.rfs.ru/tournament/1349/calendar?round_id=18268",
    "2022/23": "https://www.rfs.ru/tournament/1395/calendar?round_id=18419",
}
REVISION = "https://www.rfs.ru/news/217736"
EVENTS = (
    ("khimki_zenit_open_2021", "2021/22", "2021-07-24T17:30:00",
     "2021-07-24T14:30:00Z", "khimki", "zenit", 92, 127, 1, 3, 3, False,
     "https://www.rfs.ru/news/214019", "https://www.rfs.ru/news/214027"),
    ("krylia_nizhny_2021", "2021/22", "2021-10-17T16:30:00",
     "2021-10-17T13:30:00Z", "krylia", "nizhny_novgorod", 123, 120,
     2, 0, 4, False, None, None),
    ("sochi_krylia_2022", "2021/22", "2022-03-20T16:30:00",
     "2022-03-20T13:30:00Z", "sochi", "krylia", 62, 123,
     2, 3, 4, False, None, None),
    ("torpedo_sochi_open_2022", "2022/23", "2022-07-17T15:00:00",
     "2022-07-17T12:00:00Z", "torpedo", "sochi", 16, 62,
     1, 3, 4, False, "https://www.rfs.ru/news/216285",
     "https://www.rfs.ru/news/216299"),
    ("torpedo_zenit_2022", "2022/23", "2022-11-12T16:30:00",
     "2022-11-12T13:30:00Z", "torpedo", "zenit", 16, 127,
     0, 2, 4, False, None, None),
    ("pari_torpedo_revised_2023", "2022/23", "2023-03-19T16:30:00",
     "2023-03-19T13:30:00Z", "nizhny_novgorod", "torpedo", 120, 16,
     0, 3, 4, True, None, REVISION),
)
SUMMARY = {
    "events": 6, "season2021_22Events": 3, "season2022_23Events": 3,
    "uniqueDayMaskDirectionCandidates": 6,
    "exactUtcMinuteCandidates": 6, "officialScoreAgreements": 6,
    "publicRevisedOfficialResultsAmongEvents": 1,
    "independentlyCertifiedPrivatePlayedRows": 0,
}
DENIALS = (
    "allSeasonFixturesReviewed", "privateMatchIdsExported",
    "privateTeamIdsExported", "privateRowsExported",
    "privatePerMatchScoresExported", "privateSourceModified",
    "privateClubLegalIdentityIndependentlyCertified",
    "originalKickoffUtcIndependentlyAuthenticated",
    "originalRfsNoticeServingUtcVerified", "sourceFirstServingUtcVerified",
    "sourceTrainingRightsVerified", "playedGoalStatusForEachPrivateFixtureVerified",
    "full2021_22Or2022_23DatasetValidated", "realModelTrainingAuthorized",
    "holdout2025_26Read", "m3A3Accepted", "productionModelChanged",
)


@dataclass(frozen=True, slots=True)
class TwoSeasonRfsAudit:
    official_retrospective_anchor_matches: int = 6
    distinct_anchor_seasons: int = 2
    contaminated_official_result_examples: int = 1
    eligible_private_rows_certified: int = 0
    private_ids_exported: bool = False
    real_training_authorized: bool = False


def _refuse(reason: str) -> None:
    raise DataError("M3 two-season RFS anchors: " + reason)


def audit_two_season_rfs_anchors(
    receipt: object, previous_rosters: object
) -> TwoSeasonRfsAudit:
    """Validate only a pinned receipt and public roster participation masks."""
    if type(receipt) is not dict or type(previous_rosters) is not dict:
        _refuse("evidence objects are required")
    keys = {
        "schemaVersion", "kind", "observedOn", "scope",
        "sourceOfficialCalendars", "sourceRfsTechnicalRevision", "calendarKind",
        "events", "crossEventIdEqualityAnonymous", "administrativeResultWarning",
        "summary", "limitations",
    }
    if (
        set(receipt) != keys
        or type(receipt["schemaVersion"]) is not int
        or receipt["schemaVersion"] != 1
        or receipt["kind"] != KIND or receipt["observedOn"] != "2026-11-10"
        or receipt["scope"] != SCOPE
        or receipt["sourceOfficialCalendars"] != CALENDARS
        or receipt["sourceRfsTechnicalRevision"] != REVISION
        or receipt["calendarKind"]
        != "CURRENT_RETROSPECTIVE_RFS_OFFICIAL_CALENDAR_NOT_ORIGINAL_SERVING_TIMELINE"
    ):
        _refuse("unexpected source, chronology or scope")
    if previous_rosters.get("kind") != (
        "M3_PUBLIC_RETROSPECTIVE_SEVEN_SEASON_ROSTER_NAME_CANDIDATE"
    ):
        _refuse("independent public roster not pinned")
    roster = previous_rosters.get("seasonReferences")
    if type(roster) is not list or len(roster) != 7:
        _refuse("incomplete seven-season public membership")
    public_masks = {}
    for i, season in enumerate(roster):
        if type(season) is not dict or type(
            season.get("publicNameAliasesInFinalTableOrder")
        ) is not list or len(season["publicNameAliasesInFinalTableOrder"]) != 16:
            _refuse("malformed public club season")
        for name in season["publicNameAliasesInFinalTableOrder"]:
            if type(name) is not str or not name:
                _refuse("invalid public alias")
            public_masks[name] = public_masks.get(name, 0) | (1 << i)
    rows = receipt.get("events")
    if type(rows) is not list or len(rows) != len(EVENTS):
        _refuse("exactly six first-party anchor rows required")
    for actual, expected in zip(rows, EVENTS, strict=True):
        if type(actual) is not dict:
            _refuse("non-object anchor")
        (code, season, local, utc, home, away, hm, am, hg, ag,
         day_matches, revision, notice, recap) = expected
        expected_row = {
            "eventCode": code, "season": season,
            "publicHomeAlias": home, "publicAwayAlias": away,
            "scheduledMoscowLocal": local, "scheduledUtcFromMoscow": utc,
            "homeMask": hm, "awayMask": am,
            "retrospectiveOfficialHomeGoals": hg,
            "retrospectiveOfficialAwayGoals": ag,
            "sameUtcDayPrivateMatches": day_matches,
            "maskDirectionDayCandidates": 1,
            "exactMinuteCandidates": 1,
            "exactMinuteOfficialScoreAgreements": 1,
            "officialResultRevisedAfterPlay": revision,
            "preMatchRfsNoticeUrl": notice,
            "rfsPostMatchRecapUrl": recap,
        }
        if actual != expected_row or any(
            type(actual[k]) is not int for k in (
                "homeMask", "awayMask", "retrospectiveOfficialHomeGoals",
                "retrospectiveOfficialAwayGoals", "sameUtcDayPrivateMatches",
                "maskDirectionDayCandidates", "exactMinuteCandidates",
                "exactMinuteOfficialScoreAgreements",
            )
        ):
            _refuse("reported public match, SQL aggregate or revision altered")
        if public_masks.get(home) != hm or public_masks.get(away) != am:
            _refuse("official alias contradicts seven-season roster")
        converted = datetime.fromisoformat(local).replace(
            tzinfo=ZoneInfo("Europe/Moscow")
        ).astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
        if converted != utc:
            _refuse("Moscow to UTC conversion discrepancy")
    graph = receipt.get("crossEventIdEqualityAnonymous")
    if graph != {
        "kryliaTwo2021_22": {
            "eventCount": 2, "internalDistinctProviderIds": 1,
        },
        "torpedoThree2022_23": {
            "eventCount": 3, "internalDistinctProviderIds": 1,
        },
        "privateIdsExported": False,
    }:
        _refuse("anonymous cross-event consistency missing")
    warned = receipt.get("administrativeResultWarning")
    if warned != {
        "eventCode": "pari_torpedo_revised_2023", "date": "2023-03-19",
        "onFieldHomeGoals": 1, "onFieldAwayGoals": 1,
        "laterOfficialHomeGoals": 0, "laterOfficialAwayGoals": 3,
        "independentSource": REVISION,
        "providerArchiveMatchesLaterOfficialResult": True,
        "privateProviderOnFieldGoalsVerified": False,
        "privateRowCertifiedPlayedScore": False,
    } or any(type(warned[k]) is not int for k in (
        "onFieldHomeGoals", "onFieldAwayGoals", "laterOfficialHomeGoals",
        "laterOfficialAwayGoals",
    )):
        _refuse("administrative scored-versus-played distinction lost")
    summary = receipt.get("summary")
    if type(summary) is not dict or set(summary) != set(SUMMARY) or any(
        type(summary[k]) is not int or summary[k] != v for k, v in SUMMARY.items()
    ):
        _refuse("six-event counts or eligibility denial changed")
    limits = receipt.get("limitations")
    if type(limits) is not dict or set(limits) != set(DENIALS) or any(
        limits[k] is not False for k in DENIALS
    ):
        _refuse("private source or A3 disclosure denied")
    return TwoSeasonRfsAudit()
