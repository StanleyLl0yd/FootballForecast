"""M3-A4/A5/A6 honest, protected retrospective candidate evidence contract."""
import json
from decimal import Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/M3_A4_A5_A6_REAL_DEVELOPMENT_2026-11-11.json"
A3 = ROOT / "docs/M3_A3_SEVEN_SEASON_RETROSPECTIVE_READINESS_2026-11-11.json"
SQL = ROOT / "research/sql/m3_development_poisson_observation.sql"


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def check(e: dict, a3: dict, sql: str) -> None:
    assert e["schemaVersion"] == 1
    assert e["kind"] == "M3_A4_A5_A6_REAL_DEVELOPMENT_NON_STRICT_RETROSPECTIVE"
    assert e["status"] == "PROPOSED_A4_A5_A6_TECHNICAL_ACCEPTANCE_PENDING_A3_COMMIT"
    assert a3["totals"]["retrospectivePlayedScoreCandidates"] == 1673
    assert a3["totals"]["excludedFromPlayedGoalLabels"] == 7
    assert len(e["folds"]) == e["protectedReceipt"]["validatedFolds"] == 5
    assert e["protectedReceipt"]["candidateScoredMatches"] == 1197
    assert e["protectedReceipt"]["withheldValidationCandidates"] == 3
    assert e["protectedReceipt"]["aggregateResultsSha256"] == (
        "c9ef3e4bb37f70a451aa6c4bcb41dbe8d1a5c941543705b8c700d8e2514c2c98"
    )
    assert tuple(x["validationSeason"] for x in e["folds"]) == (
        "2020/21", "2021/22", "2022/23", "2023/24", "2024/25"
    )
    assert tuple(x["trainN"] for x in e["folds"]) == (476, 714, 954, 1193, 1433)
    assert tuple(x["scoredN"] for x in e["folds"]) == (238, 240, 239, 240, 240)
    assert sum(x["scoredN"] for x in e["folds"]) == 1197
    assert all(x["scoredN"] + x["abstainedN"] == 240 for x in e["folds"])
    assert e["comparator"]["scoredOnIdenticalFixtures"] is True
    assert e["comparator"]["bookmakerComparator"] == "UNAVAILABLE_NO_AUTHENTIC_SAME_CUTOFF_QUOTES"
    assert "WHERE (SELECT ok FROM gate)" in sql
    assert "WHERE reason IS NULL" in sql
    assert "e.season_order<f.season_order" in sql
    assert "WHERE season_order>=2" in sql
    for term in ("20*1.35", "20*1.05", "12*l.mu_h", "12*l.mu_a",
                 "least(6.0,greatest(0.05", "generate_series(0,30)"):
        assert term in sql
    for fold in e["folds"]:
        bh = Decimal(fold["baselineLogLoss"])
        ph = Decimal(fold["poissonLogLoss"])
        gain = Decimal(fold["pairedGainLogLoss"])
        assert bh.is_finite() and ph.is_finite()
        assert bh > ph > 0
        assert abs(bh - ph - gain) <= Decimal("0.000002")
        assert Decimal("0") < Decimal(fold["pairedApprox95pctHalfwidth"]) < Decimal("0.1")
        for metric in ("Brier", "Rps"):
            assert (Decimal(fold["baseline" + metric]) >
                    Decimal(fold["poisson" + metric]) > 0)
        assert 0 <= fold["unseenTeamCandidates"] <= fold["scoredN"]
    assert e["protectedReceipt"]["poissonBetterLogLossFolds"] == 5
    assert e["protectedReceipt"]["poissonBetterBrierFolds"] == 5
    assert e["protectedReceipt"]["poissonBetterRpsFolds"] == 5
    assert e["candidate"]["missingTeamIdentityHandling"] == "FAIL_CLOSED"
    assert e["candidate"]["invalidFinishedScoreHandling"] == "FAIL_CLOSED"
    for field in ("originalPrematchFeatureAvailabilityClaim", "sameSeasonLabelLeakage",
                  "allFoldGainsStatisticallySignificantClaim",
                  "serialDependenceHandledByConfidenceIntervals", "bookmakerOutperformanceClaim",
                  "independentSealedHoldoutPerformanceClaim", "consumedHoldout2025_26Access",
                  "newModelTrainedOrPersistedOutsideReadOnlySession", "m2FixedModelChanged",
                  "publicPredictionsWritten", "rlsModified", "privateRowsExported"):
        assert e["limitations"][field] is False
    assert e["gates"]["fullM3Accepted"] is False
    assert e["gates"]["publicReleaseAuthorized"] is False


def test_real_retro_development_contract() -> None:
    check(load(EVIDENCE), load(A3), SQL.read_text(encoding="utf-8"))


@pytest.mark.parametrize(("path", "bad"), [
    (("folds", 0, "trainN"), 954),
    (("folds", 4, "scoredN"), 241),
    (("folds", 1, "poissonLogLoss"), "1.300000"),
    (("folds", 2, "pairedGainLogLoss"), "0.900000"),
    (("protectedReceipt", "candidateScoredMatches"), 1200),
    (("limitations", "consumedHoldout2025_26Access"), True),
    (("limitations", "bookmakerOutperformanceClaim"), True),
    (("comparator", "bookmakerComparator"), "SAME_CUTOFF_QUOTES_AVAILABLE"),
])
def test_fabricated_performance_or_leakage_is_rejected(path: tuple, bad: object) -> None:
    e = load(EVIDENCE)
    node = e
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = bad
    with pytest.raises(AssertionError):
        check(e, load(A3), SQL.read_text(encoding="utf-8"))
