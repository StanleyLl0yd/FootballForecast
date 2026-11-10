"""Fail-closed five-season public CC0 vs private aggregate evidence audit.

This module has no database, network, file or model I/O; evidence is *not*
authorization for data training or independently verified fixture identities.
"""
from dataclasses import dataclass

from football_forecast.data.contracts import DataError

KIND = "M3_FIVE_SEASON_CC0_PRIVATE_DATE_SCORE_HISTOGRAM"
SCOPE = "RPL_DEVELOPMENT_SEASONS_2018_19_TO_2024_25_FIVE_PUBLIC_CC0_PATHS_ONLY"
METHOD = "PINNED_PUBLIC_BLOBS_PARSED_IN_MEMORY_PRIVATE_SQL_SELECT_AGGREGATES_ONLY"
SOURCES = (
    ("2018/19", "openfootball/football.json",
     "7ae2641d5504dac76f0ecbb84ca723ca36d03f82", "2018-19/ru.1.json",
     "json", 221, 23, 0),
    ("2019/20", "openfootball/football.json",
     "25a5738b595d9b6d074208e4e5df47f2c2a9bcc3", "2019-20/ru.1.json",
     "json", 221, 26, 0),
    ("2020/21", "openfootball/football.json",
     "48f77704081ac4405b98341c81b02b4664536733", "2020-21/ru.1.json",
     "json", 219, 28, 0),
    ("2023/24", "openfootball/europe",
     "3ea6829a971d1cbdf56552be0519cc125707bd99", "russia/2023-24_ru1.txt",
     "football.txt", 225, 25, 2),
    ("2024/25", "openfootball/europe",
     "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc", "russia/2024-25_ru1.txt",
     "football.txt", 227, 28, 0),
)
SUMMARY = {
    "publicRowsAcrossCheckedSeasons": 1200,
    "privateProviderFinishedRowsCompared": 1200,
    "distinctPublicDateScoreBins": 1113,
    "rawDateScoreHistogramL1Total": 2,
    "rawSeasonsWithPerfectDateScoreHistograms": 4,
    "corrected2023_24DateScoreHistogramL1": 0,
    "corrected2023_24ScoreHistogramL1": 0,
    "certifiedPrivatePlayedRows": 0,
}
ANOMALY = {
    "season": "2023/24",
    "publicPath": "russia/2023-24_ru1.txt",
    "lineNumberOneBased": 113,
    "matchDay": "2023-09-16",
    "archivedHome": "FK Sochi",
    "archivedAway": "Spartak Moskva",
    "archivedHomeGoals": 0,
    "archivedAwayGoals": 1,
    "hypotheticalHome": "Spartak Moskva",
    "hypotheticalAway": "FK Sochi",
    "hypotheticalHomeGoals": 1,
    "hypotheticalAwayGoals": 0,
    "archiveMutated": False,
    "privateSourceMutated": False,
    "originalDateScoreL1": 2,
    "hypotheticalDateScoreL1": 0,
    "note": (
        "This single public-only simulated reversal explains the entire "
        "aggregate discrepancy, but cannot establish row-level private identity "
        "or certify any other archived fixture."
    ),
}
LIMITS = {
    "publicCc0PublisherDeclarationDoesNotIndependentlyProveUpstreamRights": True,
    "privateClubIdsExported": False,
    "privateMatchesExported": False,
    "privatePerMatchScoreValuesExported": False,
    "privateRowLevelCorrespondenceCertified": False,
    "privateSourceChanges": False,
    "anyPublicArchiveModified": False,
    "realHistoricalKickoffUtcVerified": False,
    "firstSourceServingUtcVerified": False,
    "playedVsAwardedGoalsVerified": False,
    "sourceTrainingRightsVerified": False,
    "trainingEligiblePrivateRowsCertified": False,
    "m3A3Accepted": False,
    "m3A4OrA5RealRun": False,
    "holdout2025_26Read": False,
    "productionModelChanged": False,
}


@dataclass(frozen=True, slots=True)
class FiveSeasonHistogramAudit:
    publicly_checked_matches: int = 1200
    perfect_raw_date_score_seasons: int = 4
    raw_date_score_l1_difference: int = 2
    isolated_public_anomaly_correction_l1: int = 0
    certified_training_rows: int = 0
    model_training_authorized: bool = False


def _refuse(reason: str) -> None:
    raise DataError("M3 five-season histograms: " + reason)


def audit_five_season_histogram_receipt(
    receipt: object, prior_cc0_shape: object
) -> FiveSeasonHistogramAudit:
    """Validate a strictly pinned evidence receipt, not the source observations."""
    if type(receipt) is not dict or type(prior_cc0_shape) is not dict:
        _refuse("receipt and source shape must be objects")
    if (
        set(receipt) != {
            "schemaVersion", "kind", "observedDate", "scope", "method",
            "sourceCoverage", "seasons", "summary",
            "isolatedPublicAnomalySimulation", "limitations"
        }
        or type(receipt["schemaVersion"]) is not int
        or receipt["schemaVersion"] != 1
        or receipt["kind"] != KIND
        or receipt["observedDate"] != "2026-11-10"
        or receipt["scope"] != SCOPE
        or receipt["method"] != METHOD
        or receipt["sourceCoverage"] != "FIVE_OF_SEVEN_DEVELOPMENT_SEASONS"
    ):
        _refuse("unexpected scope or provenance")
    previous = prior_cc0_shape.get("developmentSeasonsObserved")
    old_repositories = prior_cc0_shape.get("sourceRepositories")
    if (
        prior_cc0_shape.get("kind")
        != "M2_INDEPENDENT_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_OBSERVATION"
        or type(previous) is not list or len(previous) != 5
        or type(old_repositories) is not list or len(old_repositories) != 2
    ):
        _refuse("independent pinned CC0 metadata missing")
    previous_by_year = {}
    for old in previous:
        if type(old) is not dict or old.get("season") in previous_by_year:
            _refuse("conflicting or duplicated older season")
        previous_by_year[old.get("season")] = old
    rows = receipt.get("seasons")
    if type(rows) is not list or len(rows) != len(SOURCES):
        _refuse("exactly five public season observations needed")
    for actual, expected in zip(rows, SOURCES, strict=True):
        if type(actual) is not dict:
            _refuse("invalid season")
        season, repo, sha, path, fmt, date_bins, score_bins, l1 = expected
        wanted = {
            "season": season,
            "publicRepo": repo,
            "publicGitBlobSha": sha,
            "publicPath": path,
            "format": fmt,
            "publicRows": 240,
            "privateProviderFinishedRows": 240,
            "publicDistinctDateScoreBins": date_bins,
            "publicDistinctScoreBins": score_bins,
            "rawScorelineHistogramL1": l1,
            "rawDateScoreHistogramL1": l1,
            "rawDateScoreDivergentBins": l1,
            "certifiedPrivatePlayedRows": 0,
        }
        if actual != wanted or any(
            type(actual[k]) is not int
            for k in (
                "publicRows", "privateProviderFinishedRows",
                "publicDistinctDateScoreBins", "publicDistinctScoreBins",
                "rawScorelineHistogramL1", "rawDateScoreHistogramL1",
                "rawDateScoreDivergentBins", "certifiedPrivatePlayedRows"
            )
        ):
            _refuse("source metadata, counts or scoreline histograms altered")
        prior = previous_by_year.get(season)
        if (
            prior is None or prior.get("repository") != repo
            or prior.get("gitBlobSha") != sha or prior.get("path") != path
            or prior.get("structuralMatchRows") != 240
            or prior.get("notProvenPlayedRows") != 240
        ):
            _refuse("earlier independently pinned CC0 source contradiction")
    summary = receipt.get("summary")
    if (
        type(summary) is not dict or set(summary) != set(SUMMARY)
        or any(type(summary[k]) is not int or summary[k] != v
               for k, v in SUMMARY.items())
    ):
        _refuse("new score histogram summary changed")
    anomaly = receipt.get("isolatedPublicAnomalySimulation")
    if type(anomaly) is not dict or anomaly != ANOMALY:
        _refuse("anomaly scenario not pinned or source was modified")
    for k in (
        "lineNumberOneBased", "archivedHomeGoals", "archivedAwayGoals",
        "hypotheticalHomeGoals", "hypotheticalAwayGoals",
        "originalDateScoreL1", "hypotheticalDateScoreL1"
    ):
        if type(anomaly[k]) is not int:
            _refuse("invalid numeric public anomaly")
    limitations = receipt.get("limitations")
    if type(limitations) is not dict or limitations != LIMITS:
        _refuse("evidence privacy, rights or no-training boundary changed")
    return FiveSeasonHistogramAudit()
