"""M3-A3: immutable retrospective seven-season source-quality receipt assertions.

This suite checks committed aggregate-only evidence and known exclusions.
It cannot certify original first-serving times, third-party rights, or play
status beyond corroborated retrospective match outcomes.
"""
import json
from collections import Counter
from pathlib import Path

import pytest

EVIDENCE = Path(__file__).resolve().parents[2] / (
    "docs/M3_A3_SEVEN_SEASON_RETROSPECTIVE_READINESS_2026-11-11.json"
)
SEASONS = ("2018/19", "2019/20", "2020/21", "2021/22",
           "2022/23", "2023/24", "2024/25")
EXCLUDED = (0, 4, 2, 0, 1, 0, 0)
TRAIN = (476, 714, 954, 1193, 1433)
VALID = (238, 240, 239, 240, 240)


def source() -> dict:
    return json.loads(EVIDENCE.read_text(encoding="utf-8"))


def validate(data: dict) -> None:
    assert type(data) is dict
    assert data["schemaVersion"] == 1
    assert data["kind"] == "M3_A3_SEVEN_SEASON_NON_STRICT_RETROSPECTIVE_DEVELOPMENT_COHORT"
    assert data["status"] == "PROPOSED_A3_TECHNICAL_ACCEPTANCE_NOT_STRICT_AS_OF"
    assert tuple(row["season"] for row in data["perSeason"]) == SEASONS
    assert tuple(
        row["knownAdministrativeOrRevisedExcluded"] for row in data["perSeason"]
    ) == EXCLUDED
    assert len(data["perSeason"]) == 7
    for row in data["perSeason"]:
        assert row["publicFixtures"] == row["privateProviderFinishedFixtures"] == 240
        assert row["scoreFreeGraphMatches"] == 240
        assert row["officialResultDisagreements"] == 0
        assert row["retrospectivePlayedScoreCandidates"] == (
            240 - row["knownAdministrativeOrRevisedExcluded"]
        )
    exclusions = data["exclusions"]
    assert len(exclusions) == 7
    assert len({(x["season"], x["dateUtc"], x["officialScore"]) for x in exclusions}) == 7
    counter = Counter(x["season"] for x in exclusions)
    assert tuple(counter[season] for season in SEASONS) == EXCLUDED
    assert sum(x["reason"] == "UNPLAYED_TECHNICAL_AWARD" for x in exclusions) == 6
    assert sum(x["reason"] == "OFFICIAL_SCORE_REVISED_AFTER_PLAY" for x in exclusions) == 1
    revised = next(x for x in exclusions if x["reason"] == "OFFICIAL_SCORE_REVISED_AFTER_PLAY")
    assert (
        revised["season"], revised["dateUtc"],
        revised["playedScore"], revised["officialScore"],
    ) == (
        "2022/23", "2023-03-19", "1:1", "0:3")
    totals = data["totals"]
    for field in ("publicFixtures", "privateProviderFinishedFixtures", "scoreFreeGraphMatches"):
        assert totals[field] == 1680
    for field in ("unmatchedPublicFixtures", "unmatchedPrivateFixtures",
                  "officialResultDisagreements"):
        assert totals[field] == 0
    assert totals["knownTechnicalAwardsExcluded"] == 6
    assert totals["knownRevisedOfficialScoresExcluded"] == 1
    assert totals["excludedFromPlayedGoalLabels"] == len(exclusions) == 7
    assert totals["retrospectivePlayedScoreCandidates"] == 1673
    assert sum(row["retrospectivePlayedScoreCandidates"] for row in data["perSeason"]) == 1673
    fold = data["expandingFolds"]
    assert tuple(x["validationSeason"] for x in fold) == SEASONS[2:]
    assert tuple(x["trainingCandidates"] for x in fold) == TRAIN
    assert tuple(x["validationScoredCandidates"] for x in fold) == VALID
    assert tuple(x["validationAbstained"] for x in fold) == (2, 0, 1, 0, 0)
    assert sum(x["validationScoredCandidates"] for x in fold) == 1197
    for i, entry in enumerate(fold):
        assert entry["trainingCandidates"] == sum(
            row["retrospectivePlayedScoreCandidates"] for row in data["perSeason"][:i+2])
        assert entry["validationScoredCandidates"] + entry["validationAbstained"] == 240
    ref = data["references"]
    assert len(ref) == 4
    assert ref[0]["matched"] == 1200 and ref[1]["publicFixtures"] == 480
    assert ref[2]["matched"] == 480 and ref[2]["playedScoreCandidates"] == 479
    assert ref[2]["officialScoreDisagreements"] == 0
    assert ref[2]["stableSharedClubIds"] == ref[2]["possibleSharedClubIds"] == 13
    for refobj in ref[1:]:
        for key, value in refobj.items():
            if key.endswith("Sha256") and isinstance(value, str):
                assert len(value) == 64 and all(ch in "0123456789abcdef" for ch in value)
    assert data["scope"]["allModelsFitOnPriorCompletedSeasonsOnly"] is True
    assert data["scope"]["sameValidationSeasonTraining"] is False
    assert data["scope"]["historicalStrictAsOfClaim"] is False
    assert data["scope"]["originalFirstServingTimeAuthenticated"] is False
    for flag in ("privateRowsExported", "privateIdsExported", "sourceTablesMutated",
                 "holdout2025_26Read", "publicForecastsPublished", "m2FixedModelChanged",
                 "existingForceRlsChanged"):
        assert data["scope"][flag] is False
    assert data["gates"]["sevenSeasonFixtureCoverageEvidenceComplete"] is True
    assert data["gates"]["productionModelApproval"] is False
    assert data["gates"]["fullM3Accepted"] is False


def test_real_aggregate_evidence_satisfies_retro_candidate_contract() -> None:
    validate(source())


@pytest.mark.parametrize(("path", "incorrect"), [
    (("totals", "retrospectivePlayedScoreCandidates"), 1680),
    (("totals", "excludedFromPlayedGoalLabels"), 0),
    (("perSeason", 4, "knownAdministrativeOrRevisedExcluded"), 0),
    (("perSeason", 5, "scoreFreeGraphMatches"), 239),
    (("expandingFolds", 4, "trainingCandidates"), 1440),
    (("scope", "holdout2025_26Read"), True),
    (("scope", "historicalStrictAsOfClaim"), True),
    (("gates", "productionModelApproval"), True),
])
def test_negative_evidence_mutations_fail_closed(path: tuple, incorrect: object) -> None:
    modified = source()
    item = modified
    for piece in path[:-1]:
        item = item[piece]
    item[path[-1]] = incorrect
    with pytest.raises(AssertionError):
        validate(modified)
