"""Pure CC0 public scoreline parser and pinned aggregate-only M3-A3 evidence audit.

No network, filesystem, database, private rows, model fitting or forecasts.
Histogram equality does not prove played goals, club identity, or source rights.
"""

import json
import re
from collections import Counter
from dataclasses import dataclass

from football_forecast.data.contracts import DataError

KIND = "M3_FIVE_SEASON_CC0_PUBLIC_VS_PRIVATE_SCORELINE_HISTOGRAM"
SCOPE = "FIVE_DEVELOPMENT_SEASONS_SELECT_ONLY_NO_PRIVATE_BINS_RETURNED"
SOURCE_INVENTORY = "M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json"
METHOD = (
    "Compare aggregated public pinned full-time scoreline distributions with "
    "anonymous private PostgreSQL SELECT-only per-season grouped counts; return "
    "only per-season total rows, histogram L1 and number of divergent scoreline bins."
)
SOURCES = (
    ("2018/19", "openfootball/football.json", "2018-19/ru.1.json",
     "e6744429ee395bc86f247348c6184bb08d4eb361",
     "7ae2641d5504dac76f0ecbb84ca723ca36d03f82", "JSON", 23, 0),
    ("2019/20", "openfootball/football.json", "2019-20/ru.1.json",
     "e6744429ee395bc86f247348c6184bb08d4eb361",
     "25a5738b595d9b6d074208e4e5df47f2c2a9bcc3", "JSON", 26, 0),
    ("2020/21", "openfootball/football.json", "2020-21/ru.1.json",
     "e6744429ee395bc86f247348c6184bb08d4eb361",
     "48f77704081ac4405b98341c81b02b4664536733", "JSON", 28, 0),
    ("2023/24", "openfootball/europe", "russia/2023-24_ru1.txt",
     "63df627f3c87ce71708f016522ea236cf74332c3",
     "3ea6829a971d1cbdf56552be0519cc125707bd99", "FOOTBALL_TXT", 25, 2),
    ("2024/25", "openfootball/europe", "russia/2024-25_ru1.txt",
     "63df627f3c87ce71708f016522ea236cf74332c3",
     "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc", "FOOTBALL_TXT", 28, 0),
)
SCORE = re.compile(r"\s+([0-9]+)-([0-9]+)(?:\s+\([0-9]+-[0-9]+\))?\s*$")
REQUIRED_FALSE_FLAGS = (
    "privateIdsExported", "privateRowsExported", "privateSourceScoreBinsExported",
    "privateIndividualScoresExported", "publicArchiveRawRowsCommitted",
    "privateIdCrosswalkVerified", "eachFixtureIndependentlyMatched",
    "playedVersusAwardedStatusVerified", "historicalKickoffUtcVerified",
    "sourceFirstPublicationUtcVerified", "originalUpstreamTrainingRightsVerified",
    "realTrainingAuthorized", "holdout2025_26Read",
    "productionModelChanged", "publicForecastsWritten",
)


def _deny(message: str) -> None:
    raise DataError("M3 scoreline histogram: " + message)


def public_scoreline_histogram(raw: str, source_format: str) -> Counter:
    """Read only caller-provided PUBLIC text. Keep technical-award scores in totals.

    This checks the archive's reported full-time score shape. It does NOT
    declare these 240 results played or historically available.
    """
    if type(raw) is not str or not raw.strip():
        _deny("empty public source")
    scores = []
    if source_format == "JSON":
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            _deny("invalid public JSON")
        if type(payload) is not dict or type(payload.get("matches")) is not list:
            _deny("missing matches")
        for match in payload["matches"]:
            if type(match) is not dict:
                _deny("invalid match")
            score = match.get("score")
            if type(score) is not dict:
                _deny("missing match score")
            pair = score.get("ft")
            if type(pair) is not list or len(pair) != 2:
                _deny("invalid full-time pair")
            scores.append(tuple(pair))
    elif source_format == "FOOTBALL_TXT":
        for line in raw.splitlines():
            if " v " not in line:
                continue
            m = SCORE.search(line)
            if m is None:
                _deny("missing full-time score on fixture line")
            scores.append((int(m[1]), int(m[2])))
    else:
        _deny("unsupported public source format")
    if len(scores) != 240:
        _deny("incomplete or duplicated public season")
    for pair in scores:
        if any(type(value) is not int or value < 0 or value > 20 for value in pair):
            _deny("non-numeric or implausible score")
    return Counter(scores)


@dataclass(frozen=True, slots=True)
class ScorelineHistogramAudit:
    public_score_rows_compared: int = 1200
    private_rows_in_aggregate: int = 1200
    exact_histogram_seasons: int = 4
    public_direction_hypothesis_removes_one_marginal_discrepancy: bool = True
    independent_private_played_labels: int = 0
    real_training_authorized: bool = False


def audit_scoreline_histogram_receipt(document: object) -> ScorelineHistogramAudit:
    """Check pinned declared facts and denial flags, NOT source or SQL execution."""
    if type(document) is not dict:
        _deny("receipt must be an object")
    keys = {
        "schemaVersion", "kind", "observedOn", "scope", "sourceInventory", "method",
        "seasons", "hypotheticalPublicArchiveDirectionCorrection",
        "aggregate", "limitations",
    }
    if (set(document) != keys
            or type(document["schemaVersion"]) is not int
            or document["schemaVersion"] != 1
            or document["kind"] != KIND or document["observedOn"] != "2026-11-10"
            or document["scope"] != SCOPE
            or document["sourceInventory"] != SOURCE_INVENTORY
            or document["method"] != METHOD):
        _deny("source or scope changed")
    seasons = document["seasons"]
    if type(seasons) is not list or len(seasons) != 5:
        _deny("five source seasons required")
    for item, spec in zip(seasons, SOURCES, strict=True):
        if type(item) is not dict:
            _deny("invalid season evidence")
        season, repo, path, commit, blob, fmt, bins, l1 = spec
        expected = {
            "season": season, "repository": repo, "path": path,
            "pinnedCommitSha": commit, "gitBlobSha": blob, "format": fmt,
            "publicDistinctScorelineBins": bins, "histogramL1Difference": l1,
            "differingScorelineBins": l1, "publicRows": 240, "privateRows": 240,
            "sourceDeclaredCC0": True, "underlyingRecordProvenanceVerified": False,
        }
        if item != expected or any(type(item[key]) is not int for key in (
            "publicDistinctScorelineBins", "histogramL1Difference",
            "differingScorelineBins", "publicRows", "privateRows")):
            _deny("public source pin, data, or eligibility changed")
    expected_hypothesis = {
        "season": "2023/24", "publicArchiveLine": 113,
        "originalPublishedHome": "FK Sochi",
        "originalPublishedAway": "Spartak Moskva",
        "originalPublishedHomeGoals": 0,
        "originalPublishedAwayGoals": 1,
        "hypotheticalHomeGoalsAfterPublicDirectionReversal": 1,
        "hypotheticalAwayGoalsAfterPublicDirectionReversal": 0,
        "provenance": "M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json",
        "publicArchiveFileWasModified": False,
        "privateRowsWereModified": False,
        "originalHistogramL1": 2,
        "hypotheticalSinglePublicResultReorientationL1": 0,
        "originalDivergentScorelineBins": 2,
        "hypotheticalDivergentScorelineBins": 0,
        "interpretation": (
            "One public fixture-direction error is sufficient to explain the aggregate "
            "discrepancy; histogram agreement does not identify individual private rows "
            "or prove played-score authenticity."
        ),
    }
    hypothesis = document["hypotheticalPublicArchiveDirectionCorrection"]
    if (type(hypothesis) is not dict or hypothesis != expected_hypothesis
            or type(hypothesis["publicArchiveLine"]) is not int
            or type(hypothesis["originalPublishedHomeGoals"]) is not int
            or type(hypothesis["originalPublishedAwayGoals"]) is not int):
        _deny("known public source anomaly was changed")
    expected_aggregate = {
        "publicRowsCompared": 1200, "privateRowsCompared": 1200,
        "exactHistogramMatchSeasons": 4, "originalHistogramL1Total": 2,
        "originalDifferingScorelineBinsTotal": 2,
        "developmentSeasonsWithoutCheckedCC0References": ["2021/22", "2022/23"],
        "independentlyCertifiedEligiblePrivateRows": 0,
    }
    agg = document["aggregate"]
    if (type(agg) is not dict or agg != expected_aggregate
            or any(type(agg[k]) is not int for k in (
                "publicRowsCompared", "privateRowsCompared", "exactHistogramMatchSeasons",
                "originalHistogramL1Total", "originalDifferingScorelineBinsTotal",
                "independentlyCertifiedEligiblePrivateRows"))):
        _deny("aggregate or certified-training count changed")
    limits = document["limitations"]
    if (type(limits) is not dict or set(limits) != set(REQUIRED_FALSE_FLAGS)
            or any(limits[k] is not False for k in REQUIRED_FALSE_FLAGS)):
        _deny("privacy, training or 2025/26 denial changed")
    return ScorelineHistogramAudit()
