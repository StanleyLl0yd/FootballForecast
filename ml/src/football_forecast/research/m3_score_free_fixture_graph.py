"""Validate a bounded score-free structural cross-provider fixture receipt.

No DB, network, filesystem, model, or live source IO. A matching graph is not
an independent legal club identity, played-goal, UTC, rights, or as-of proof.
"""
from dataclasses import dataclass

from football_forecast.data.contracts import DataError

KIND = "M3_FIVE_SEASON_SCORE_FREE_ANONYMOUS_FIXTURE_CORRESPONDENCE"
SCOPE = "FIVE_PINNED_CC0_DEVELOPMENT_SEASONS_SELECT_ONLY_NO_PRIVATE_ID_EXPORT"
SOURCE = "M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_EVIDENCE.json"
ROSTER = "M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json"
METHOD = (
    "Public season/date/home-away seven-season participation masks matched to "
    "private provider UTC-date/home-away masks WITHOUT USING GOALS; reciprocal "
    "seed singletons induce consistency-only alias-to-private-ID links inside SQL; "
    "all candidates then filtered by those links; only after resolution compare "
    "scores as an aggregate."
)
FILES = (
    ("2018/19", "openfootball/football.json", "2018-19/ru.1.json",
     "7ae2641d5504dac76f0ecbb84ca723ca36d03f82", 209, 31),
    ("2019/20", "openfootball/football.json", "2019-20/ru.1.json",
     "25a5738b595d9b6d074208e4e5df47f2c2a9bcc3", 219, 21),
    ("2020/21", "openfootball/football.json", "2020-21/ru.1.json",
     "48f77704081ac4405b98341c81b02b4664536733", 202, 38),
    ("2023/24", "openfootball/europe", "russia/2023-24_ru1.txt",
     "3ea6829a971d1cbdf56552be0519cc125707bd99", 217, 23),
    ("2024/25", "openfootball/europe", "russia/2024-25_ru1.txt",
     "6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc", 216, 24),
)
GRAPH = {
    "publicFixtureRows": 1200,
    "privateProviderFinishedRows": 1200,
    "initialReciprocalSeedSingletons": 1063,
    "initialAmbiguousPublicFixtures": 137,
    "postConsistencyResolvedPublicFixtures": 1200,
    "postConsistencyUnresolvedPublicFixtures": 0,
    "postConsistencyUnresolvedPrivateFixtures": 0,
    "postLinkScoreDisagreements": 0,
    "distinctPublicAliasesObserved": 25,
    "internalPublicAliasesHavingMultipleProviderIds": 0,
    "internalProviderIdsHavingMultiplePublicAliases": 0,
    "independentlyCertifiedEligiblePrivateRows": 0,
}
SWAP = {
    "archivedFixtureDay": "2023-09-16",
    "archivedPublicHome": "FK Sochi",
    "archivedPublicAway": "Spartak Moskva",
    "archivedReportedScore": "0:1",
    "hypotheticalPublicHome": "Spartak Moskva",
    "hypotheticalPublicAway": "FK Sochi",
    "hypotheticalScore": "1:0",
    "sourceFileLine": 113,
    "publicRecordsCorrectedInMemory": 1,
    "publicArchiveModified": False,
    "privateArchiveModified": False,
    "originalRfsKickoffUtcAttested": False,
    "correctionGroundedInPreviouslyRecordedIndependentClubAndRfsReferences": True,
}
DENIALS = (
    "privateIdsExported", "privateRowsExported", "privateSourceMatchIdsExported",
    "privateIndividualScoreValuesExported", "publicMatchRecordsCommitted",
    "sourceClubLegalIdentityIndependentlyCertified",
    "crossSourceIndependentOriginalFeedVerified", "actualKickoffUtcVerified",
    "originalFirstServingUtcVerified", "playedVsAwardedGoalStatusVerified",
    "sourceTrainingRightsVerified", "originalSourceLicenseForDerivedModelVerified",
    "allSevenSeasonsCovered", "independentlyEligiblePrivateRowsCertified",
    "heldoutDataRead", "realModelFitted", "supabaseTablesMutated",
    "rlsModified", "productionModelChanged", "modelEscrowChanged",
)


@dataclass(frozen=True, slots=True)
class StructuralFixtureGraphAudit:
    no_score_seed_matches: int = 1063
    consistency_resolved_matches: int = 1200
    score_disagreements_after_resolution: int = 0
    independently_certified_training_rows: int = 0
    real_training_authorized: bool = False


def _deny(reason: str) -> None:
    raise DataError("M3 score-free fixture graph: " + reason)


def audit_score_free_fixture_graph(
    current: object, prior_histogram: object, public_roster: object
) -> StructuralFixtureGraphAudit:
    """Pin reported anonymous SQL counts, not authenticate SQL or issue A3 approval."""
    if any(type(o) is not dict for o in (current, prior_histogram, public_roster)):
        _deny("evidence objects required")
    c = current
    if (
        set(c) != {
            "schemaVersion", "kind", "observedOn", "scope",
            "sourceInventory", "publicRosterSource", "sourceFiles", "method",
            "public2023_24OneFixtureDirectionCorrection", "seasons", "graphTotals",
            "gateStatus", "limitations",
        }
        or type(c["schemaVersion"]) is not int or c["schemaVersion"] != 1
        or c["kind"] != KIND or c["scope"] != SCOPE
        or c["observedOn"] != "2026-11-10"
        or c["sourceInventory"] != SOURCE or c["publicRosterSource"] != ROSTER
        or c["method"] != METHOD
    ):
        _deny("scope, source or method drift")
    if (
        prior_histogram.get("kind")
        != "M3_FIVE_SEASON_CC0_PRIVATE_DATE_SCORE_HISTOGRAM"
        or public_roster.get("kind")
        != "M3_PUBLIC_RETROSPECTIVE_SEVEN_SEASON_ROSTER_NAME_CANDIDATE"
    ):
        _deny("missing independently pinned source provenance")
    prior = prior_histogram.get("seasons")
    old_rosters = public_roster.get("seasonReferences")
    files = c.get("sourceFiles")
    seasons = c.get("seasons")
    if (
        type(prior) is not list or len(prior) != 5
        or type(old_rosters) is not list or len(old_rosters) != 7
        or type(files) is not list or len(files) != 5
        or type(seasons) is not list or len(seasons) != 5
    ):
        _deny("wrong five-season source coverage or seven-year roster")
    for source_file, row, old, spec in zip(files, seasons, prior, FILES, strict=True):
        if any(type(item) is not dict for item in (source_file, row, old)):
            _deny("invalid source or season row")
        name, repo, path, blob, seeds, ambiguous = spec
        expected_file = {
            "season": name, "repository": repo, "path": path, "blobSha": blob,
        }
        if source_file != expected_file:
            _deny("new source file or unpinned historical data")
        if any(old.get(k) != value for k, value in (
            ("season", name), ("publicRepo", repo),
            ("publicPath", path), ("publicGitBlobSha", blob),
            ("publicRows", 240), ("privateProviderFinishedRows", 240),
        )):
            _deny("previous pinned public/private receipt changed")
        expected_season = {
            "season": name,
            "publicFixtures": 240,
            "privateProviderFinishedFixtures": 240,
            "unmatchedByDateMaskDirection": 0,
            "reciprocalSeedSingletons": seeds,
            "initialAmbiguous": ambiguous,
            "postConsistencyResolved": 240,
            "postConsistencyUnresolvedPublic": 0,
            "postConsistencyUnresolvedPrivate": 0,
            "postLinkScoreDisagreements": 0,
            "certifiedPlayedGoalPrivateRows": 0,
        }
        if (
            row != expected_season
            or any(type(row[k]) is not int for k in expected_season if k != "season")
        ):
            _deny("count, identity graph or denial contradiction")
    if c.get("public2023_24OneFixtureDirectionCorrection") != SWAP:
        _deny("public-only direction correction changed")
    if type(c["public2023_24OneFixtureDirectionCorrection"]["sourceFileLine"]) is not int:
        _deny("invalid public-only correction line")
    if c.get("graphTotals") != GRAPH:
        _deny("graph totals or certified eligible rows changed")
    if any(type(c["graphTotals"][k]) is not int for k in GRAPH):
        _deny("numeric audit fields may not be booleans")
    if c.get("gateStatus") != {
        "m3AcceptedCriteria": 2, "m3ExitCriteria": 8,
        "m3A3Accepted": False, "realM3TrainingAuthorized": False,
        "holdout2025_26Read": False, "productionForecastChanged": False,
    }:
        _deny("M3 or holdout gate escalation")
    gates = c["gateStatus"]
    if type(gates["m3AcceptedCriteria"]) is not int or type(gates["m3ExitCriteria"]) is not int:
        _deny("invalid milestone integer")
    limits = c.get("limitations")
    if type(limits) is not dict or set(limits) != set(DENIALS):
        _deny("invalid privacy / source limitations")
    if any(limits[k] is not False for k in DENIALS):
        _deny("private source exposure or training falsely approved")
    return StructuralFixtureGraphAudit()
