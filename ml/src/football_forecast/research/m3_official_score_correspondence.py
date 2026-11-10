"""Validate a public RFS+anonymous SQL aggregate score receipt without source access.

Public official results may be revised and are not automatically played goals.
No database/network/file I/O or ability to certify training eligibility.
"""
from dataclasses import dataclass
from datetime import date, datetime

from football_forecast.data.contracts import DataError

CALENDAR = "https://www.rfs.ru/tournament/1434/calendar?round_id=18568"
KIND = "M3_SIX_FIRST_PARTY_NOTICE_AND_ANONYMOUS_SCORE_SHAPE"
SCOPE = "RPL_2023_24_DEV_ONLY_ANONYMOUS_SQL_SELECT"
ANCHOR_FILE = "M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_EVIDENCE.json"

EXPECTED = (
    ("spartak_sochi_sep16", "2023-09-14", "https://www.rfs.ru/news/218948", 1, 0),
    ("sochi_spartak_apr13", "2024-04-12", "https://www.rfs.ru/news/220209", 1, 0),
    ("sochi_zenit_oct07", "2023-10-06", "https://www.rfs.ru/news/219089", 0, 2),
    ("rubin_zenit_sep17", "2023-09-14", "https://www.rfs.ru/news/218948", 0, 3),
    ("sochi_dinamo_nov06", "2023-11-03", "https://www.rfs.ru/news/219310", 3, 3),
    ("dinamo_pari_sep15", "2023-09-14", "https://www.rfs.ru/news/218948", 1, 1),
)
COUNTS = {
    "expectedEvents": 6,
    "anonymousExactMinuteMatches": 6,
    "officialScoreAgreements": 6,
    "officialScoreDisagreements": 0,
    "nonuniqueEventCount": 0,
    "eventsFound": 6,
    "missingEvents": 0,
    "seasonSnapshotCount": 1,
    "certifiedEligiblePrivateRows": 0,
}
LIMITATIONS = {
    "publicOfficialScoresOnlyInEvidence": True,
    "privateGoalColumnsComparedInternally": True,
    "privateScoreValuesExported": False,
    "privateIdsExported": False,
    "privateMatchRowsExported": False,
    "privateClubIdToOfficialClubNameCertifiable": False,
    "playedGoalStatusIndependentlyVerified": False,
    "actualHistoricalKickoffUtcAuthenticated": False,
    "originalNoticeFirstServingUtcAuthenticated": False,
    "sourceTrainingRightsVerified": False,
    "realM3TrainingAuthorized": False,
    "holdout2025_26Read": False,
    "productionModelChanged": False,
    "publicForecastsWritten": False,
}


@dataclass(frozen=True, slots=True)
class OfficialScoreAudit:
    official_result_shape_agreements: int = 6
    independent_played_goal_labels: int = 0
    certified_eligible_private_rows: int = 0
    private_rows_exported: bool = False
    real_training_authorized: bool = False


def _fail(reason: str) -> None:
    raise DataError("M3 six official scores: " + reason)


def audit_official_score_correspondence(
    receipt: object, previous_anchor: object
) -> OfficialScoreAudit:
    """Validate exactly the public score constants and the private aggregate.

    The claimed SQL result cannot independently attest its own execution or
    original source timestamp; a passing audit MUST NOT promote training data.
    """
    if type(receipt) is not dict or type(previous_anchor) is not dict:
        _fail("non-object evidence")
    expected_keys = {
        "schemaVersion", "kind", "observedOn", "scope", "previousAnchorReceipt",
        "retrospectiveOfficialCalendarUrl", "originalRfsNoticeTimestampIntegrity",
        "scoreSourceNature", "events", "aggregatePrivateSelect", "limitations",
    }
    if (set(receipt) != expected_keys
            or type(receipt.get("schemaVersion")) is not int
            or receipt["schemaVersion"] != 1
            or receipt["kind"] != KIND or receipt["observedOn"] != "2026-11-10"
            or receipt["scope"] != SCOPE
            or receipt["previousAnchorReceipt"] != ANCHOR_FILE
            or receipt["retrospectiveOfficialCalendarUrl"] != CALENDAR
            or receipt["originalRfsNoticeTimestampIntegrity"]
            != "NOT_INDEPENDENTLY_AUTHENTICATED"
            or receipt["scoreSourceNature"]
            != "RFS_RETROSPECTIVE_OFFICIAL_RESULT_NOT_PROOF_OF_PLAYED_GOALS"):
        _fail("provenance scope or no-eligibility boundary")
    prior = previous_anchor
    if (prior.get("kind") != "M3_MASK127_RETROSPECTIVE_OFFICIAL_FIXTURE_ANCHOR_GRAPH"
            or prior.get("scope") != "2023_24_DEVELOPMENT_SELECT_ONLY_ANONYMOUS_AGGREGATES"
            or prior.get("sourceRfsCalendar") != CALENDAR):
        _fail("invalid older anchor source")
    prior_events = prior.get("events")
    if type(prior_events) is not list or len(prior_events) != 6:
        _fail("missing earlier six anchors")
    limits = prior.get("limitations")
    if (type(limits) is not dict
            or limits.get("privateIdsExported") is not False
            or limits.get("privateRowsExported") is not False
            or limits.get("realTrainingAuthorized") is not False
            or limits.get("eligiblePrivateRowsCertified") is not False
            or limits.get("holdout2025_26Read") is not False):
        _fail("earlier privacy or eligibility denial lost")
    reported = receipt.get("events")
    if type(reported) is not list or len(reported) != len(EXPECTED):
        _fail("six ordered, first-party documented events required")
    if type(receipt.get("aggregatePrivateSelect")) is not dict:
        _fail("private aggregate counts must be an object")
    aggregates = receipt["aggregatePrivateSelect"]
    if (set(aggregates) != set(COUNTS)
            or any(type(aggregates[k]) is not int or aggregates[k] != v
                   for k, v in COUNTS.items())):
        _fail("invalid SQL aggregate or certified count")
    if (type(receipt.get("limitations")) is not dict
            or receipt["limitations"] != LIMITATIONS):
        _fail("limitations or privacy disclosure changed")
    for prior_item, actual, expected in zip(prior_events, reported, EXPECTED, strict=True):
        if type(prior_item) is not dict or type(actual) is not dict:
            _fail("invalid event object")
        code, notice_date, notice_url, home_goals, away_goals = expected
        expectation = {
            "eventCode": code,
            "displayedNoticeDate": notice_date,
            "preMatchNoticeUrl": notice_url,
            "scoreSourceUrl": CALENDAR,
            "homeOfficialGoals": home_goals,
            "awayOfficialGoals": away_goals,
            "privateExactMinuteAndMaskCandidates": 1,
            "privateScoreShapeAgreementCount": 1,
        }
        if actual != expectation or any(
            type(actual[k]) is not int for k in (
                "homeOfficialGoals", "awayOfficialGoals",
                "privateExactMinuteAndMaskCandidates", "privateScoreShapeAgreementCount"
            )
        ):
            _fail("event source, score, or aggregate altered")
        if (prior_item.get("eventCode") != code
                or prior_item.get("exactUtcMinuteCount") != 1
                or prior_item.get("privateMaskDirectionCount") != 1
                or prior_item.get("season") != "2023/24"):
            _fail("earlier fixture/UTC evidence changed")
        try:
            original_date = date.fromisoformat(notice_date)
            scheduled_day = datetime.fromisoformat(
                prior_item["scheduledUtc"].replace("Z", "+00:00")
            ).date()
        except (ValueError, TypeError, KeyError):
            _fail("invalid earlier UTC or notice date")
        if not original_date < scheduled_day:
            _fail("official notice is not dated before the fixture")
    return OfficialScoreAudit()
