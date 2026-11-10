"""M3 retrospective public-fixture anchors for three anonymous mask-127 clubs.

Pure aggregate receipt validation. Never reads a private source, model, result,
real club identifier, 2025/26 holdout, network, or database. It cannot grant A3.
"""
from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from football_forecast.data.contracts import DataError

SOURCE = "https://www.rfs.ru/tournament/1434/calendar?round_id=18568"
KIND = "M3_MASK127_RETROSPECTIVE_OFFICIAL_FIXTURE_ANCHOR_GRAPH"
SCOPE = "2023_24_DEVELOPMENT_SELECT_ONLY_ANONYMOUS_AGGREGATES"
PRIOR = "M3_NINE_OFFICIAL_UTC_MINUTE_EVIDENCE.json"
# event, public club, home, away, home/away masks, Moscow, UTC, day total, prior nine-event code
EXPECTED = (
    ("spartak_sochi_sep16", "spartak", "spartak", "sochi", 127, 62,
     "2023-09-16T19:00:00", "2023-09-16T16:00:00Z", 4, "sochi_spartak_a"),
    ("sochi_spartak_apr13", "spartak", "sochi", "spartak", 62, 127,
     "2024-04-13T14:00:00", "2024-04-13T11:00:00Z", 4, "sochi_spartak_b"),
    ("sochi_zenit_oct07", "zenit", "sochi", "zenit", 62, 127,
     "2023-10-07T14:00:00", "2023-10-07T11:00:00Z", 4, "sochi_zenit_oct07"),
    ("rubin_zenit_sep17", "zenit", "rubin", "zenit", 111, 127,
     "2023-09-17T16:30:00", "2023-09-17T13:30:00Z", 3, None),
    ("sochi_dinamo_nov06", "dinamo_moscow", "sochi", "dinamo_moscow", 62, 127,
     "2023-11-06T19:30:00", "2023-11-06T16:30:00Z", 3, "sochi_dynamo_nov06"),
    ("dinamo_pari_sep15", "dinamo_moscow", "dinamo_moscow", "nizhny_novgorod",
     127, 120, "2023-09-15T19:00:00", "2023-09-15T16:00:00Z", 1, None),
)
DENIALS = (
    "privateIdsExported",
    "privateRowsExported",
    "scoreFieldsRead",
    "privateIdToOfficialClubIdentityVerified",
    "playedScoreStatusVerified",
    "actualKickoffUtcVerified",
    "firstServingUtcVerified",
    "sourceTrainingRightsVerified",
    "eligiblePrivateRowsCertified",
    "realTrainingAuthorized",
    "holdout2025_26Read",
    "publicForecastsWritten",
)


@dataclass(frozen=True, slots=True)
class Mask127AnchorAudit:
    unique_official_fixture_candidates: int = 6
    distinct_linked_anonymous_clubs: int = 3
    uniquely_linked_public_aliases: int = 3
    distinct_anonymous_sochi_ids: int = 1
    independently_eligible_private_rows: int = 0
    named_private_club_crosswalk_certified: bool = False
    real_training_authorized: bool = False
    holdout_read: bool = False


def _deny(reason: str) -> None:
    raise DataError("M3 mask-127 anchors: " + reason)


def _dict(data: object, label: str) -> dict:
    if type(data) is not dict:
        _deny("invalid " + label)
    return data


def _num(value: object, expected: int) -> bool:
    return type(value) is int and value == expected


def audit_mask127_anchor_graph(current: dict, previous_nine: dict) -> Mask127AnchorAudit:
    """Fail-closed public-source+anonymous-SQL receipt check, not ID proof.

    The new public matches separate three prior same-mask candidates using
    date/side/UTC/minute and anonymous equality aggregates. No IDs or goals
    are ever inputs; no unique official legal-club identity is inferred.
    """
    c = _dict(current, "anchor receipt")
    p = _dict(previous_nine, "prior nine-minute receipt")
    if (set(c) != {"schemaVersion", "kind", "observedOn", "scope",
                   "sourceRfsCalendar", "priorNineReceipt", "events",
                   "anonymousGraph", "limitations"}
            or type(c.get("schemaVersion")) is not int
            or c.get("schemaVersion") != 1 or c.get("kind") != KIND
            or c.get("observedOn") != "2026-11-10" or c.get("scope") != SCOPE
            or c.get("sourceRfsCalendar") != SOURCE or c.get("priorNineReceipt") != PRIOR):
        _deny("unexpected scope or public provenance")
    if (p.get("schemaVersion") != 1 or p.get("kind")
            != "M3_NINE_OFFICIAL_RETROSPECTIVE_UTC_MINUTE_ANONYMOUS_GRAPH"
            or _dict(p.get("sourceDocuments"), "prior sources").get("rfsCalendar") != SOURCE):
        _deny("prior independent calendar evidence is missing")
    prior_limits = _dict(p.get("limitations"), "prior limitations")
    for flag in ("privateIdsExported", "privateRowsExported", "scoreFieldsRead",
                 "privateOfficialClubIdMapVerified", "playedGoalStatusVerified",
                 "realTrainingAuthorized", "holdout2025_26Read"):
        if prior_limits.get(flag) is not False:
            _deny("prior nine-event denial not preserved")
    prior = p.get("events")
    if type(prior) is not list or len(prior) != 9:
        _deny("prior official nine-event sample must be complete")
    prior_by_code = {}
    for item in prior:
        entry = _dict(item, "prior fixture")
        code = entry.get("eventCode")
        if type(code) is not str or code in prior_by_code:
            _deny("missing or duplicated prior event code")
        prior_by_code[code] = entry

    limits = _dict(c.get("limitations"), "limitations")
    if set(limits) != set(DENIALS) or any(limits.get(key) is not False for key in DENIALS):
        _deny("incorrect negative gates or unauthorized training/disclosure claim")
    records = c.get("events")
    if type(records) is not list or len(records) != len(EXPECTED):
        _deny("six pinned public events required")
    for record, values in zip(records, EXPECTED, strict=True):
        (code, club, home, away, hm, am, local, utc, day_count, prior_code) = values
        e = _dict(record, "official event")
        expected = {
            "eventCode": code, "season": "2023/24", "publicClubAlias": club,
            "homeAlias": home, "awayAlias": away,
            "homeMask": hm, "awayMask": am,
            "scheduledLocalMoscow": local, "scheduledUtc": utc,
            "privateDayMatches": day_count,
            "privateMaskDirectionCount": 1, "exactUtcMinuteCount": 1,
            "priorNineEventCode": prior_code,
        }
        if e != expected or any(type(e[k]) is not int for k in (
                "homeMask", "awayMask", "privateDayMatches",
                "privateMaskDirectionCount", "exactUtcMinuteCount")):
            _deny("altered event, UTC minute, role, source, or aggregate count")
        observed_utc = datetime.fromisoformat(local).replace(
            tzinfo=ZoneInfo("Europe/Moscow")
        ).astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
        if observed_utc != utc:
            _deny("retrospective Moscow-to-UTC conversion differs")
        if prior_code:
            old = prior_by_code.get(prior_code)
            if (old is None or old.get("season") != "2023/24"
                    or old.get("homeAlias") != home or old.get("awayAlias") != away
                    or not _num(old.get("homeMask"), hm)
                    or not _num(old.get("awayMask"), am)
                    or old.get("scheduledUtc") != utc
                    or old.get("scheduledLocalMoscow") != local
                    or not _num(old.get("privateDayMatches"), day_count)
                    or not _num(old.get("privateMaskDirectionCount"), 1)
                    or not _num(old.get("exactUtcMinuteCount"), 1)):
                _deny("independent nine-event receipt contradicts anchor")
    graph = _dict(c.get("anonymousGraph"), "anonymous graph")
    expected_graph = {
        "exactCandidateRows": 6,
        "eventsCovered": 6,
        "nonuniqueEvents": 0,
        "uniquelyLinkedPublicClubAliases": 3,
        "distinctAnonymousClubIds": 3,
        "distinctAnonymousSochiIds": 1,
        "certifiedPrivateClubIdMappings": 0,
        "certifiedPlayedPrivateRows": 0,
    }
    if (set(graph) != set(expected_graph)
            or any(not _num(graph[k], value) for k, value in expected_graph.items())):
        _deny("anonymous graph counts, privacy or training denominator changed")
    return Mask127AnchorAudit()
