"""M3 real PostgreSQL diagnostic evidence: aggregate privacy invariants only."""
from json import loads
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = loads((
    ROOT / "docs" / "M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json"
).read_text(encoding="utf-8"))


def test_read_only_scope_and_sealed_holdout_exclusion():
    assert EVIDENCE["schemaVersion"] == 1
    assert EVIDENCE["kind"] == "M3_PRIVATE_DEVELOPMENT_AGGREGATE_ONLY_SOURCE_DIAGNOSTIC"
    assert EVIDENCE["queryType"] == "READ_ONLY_SELECT_EXISTING_FF_PRIVATE_DEVELOPMENT_TABLES"
    assert EVIDENCE["region"] == "eu-central-1"
    assert EVIDENCE["postgresMajor"] == 17
    assert EVIDENCE["eligibleDevelopmentSeasons"] == [
        f"{year}/{(year + 1) % 100:02d}" for year in range(2018, 2025)
    ]
    assert EVIDENCE["totalSourceFinishedRecords"] == 1680
    assert EVIDENCE["matchesPerSeason"] == 240
    assert EVIDENCE["allSeasonClubCounts"] == 16
    assert all(row["records"] == 240 for row in EVIDENCE["perSeason"])
    assert all(row["sourceFirstPublicationCount"] == 0 for row in EVIDENCE["perSeason"])
    assert all(row["historicalPrematchVerifiedCount"] == 0
               for row in EVIDENCE["perSeason"])


def test_six_award_day_candidate_scorelines_not_automatically_excluded():
    days = EVIDENCE["publicAnomalyDayCalendarCandidateCounts"]
    assert len(days) == 9
    assert len({row["day"] for row in days}) == 9
    technical = [row for row in days
                 if row["publicEvidenceCategory"] == "TECHNICAL_AWARD"]
    assert len(technical) == 6
    assert [row["privateMatchesOnSameUtcDay"] for row in technical] == [5, 6, 4, 8, 3, 2]
    assert [row["threeZeroOrZeroThreePrivateScorelines"] for row in technical] == [1] * 6
    assert any(row["publicEvidenceCategory"] == "OFFICIAL_RESULT_REVISION"
               for row in days)
    assert any(row["publicEvidenceCategory"] == "PUBLIC_HOME_AWAY_DIRECTION_ANOMALY"
               for row in days)
    assert EVIDENCE["limitations"]["matchSpecificTeamAndSourceIdsCompared"] is False
    assert EVIDENCE["limitations"][
        "sixDatesYieldSixIndependentlyVerifiedPrivateTechnicalAwards"
    ] is False


def test_strong_date_and_recurring_team_id_patterns_are_not_proof_of_identity():
    cross = EVIDENCE["independentPublicAndPrivateStructuralCrosschecks"]
    assert cross["kind"] == "CROSS_DATE_SCORE_AND_PROVIDER_ID_CONSISTENCY_ONLY"
    assert cross["sixTechnicalAwardExactDaysAndScoreDirectionsUnique"] is True
    assert cross["samePrivateHomeClubOnBoth2020OrenburgAwardDates"] is True
    assert cross["samePrivateAwayClubOnBoth2020SochiAwardDates"] is True
    assert cross["samePrivateRotorClubAsHomeAndAwayAcrossTwo2020AwardDates"] is True
    assert cross["theseStructuralConstraintsProveRealClubNames"] is False
    revised = cross["officialResultRevision2022_23"]
    assert revised["observedDay"] == "2023-03-19"
    assert revised["publicRecordedOnFieldScore"] == "1:1"
    assert revised["publicOfficialDecisionScore"] == "0:3"
    assert revised["privateDayCount0_3"] == 1
    assert revised["privateDayCount1_1"] == 0
    assert revised["privateFixtureIdentityVerified"] is False
    assert revised["matchSpecificPrivateScoreCorrespondenceProven"] is False
    assert revised["automaticCorrectedPlayedScoreWritten"] is False
    swap = cross["season2023_24OfficialHomeAwaySwap"]
    assert swap["firstDay"] == "2023-09-16"
    assert swap["returnDay"] == "2024-04-13"
    assert swap["privateFirstDayCount1_0"] == 1
    assert swap["privateReturnDayCount1_0"] == 1
    assert swap["matchingPrivateReversedClubIdPairs"] == 1
    assert swap["independentExternalClubNameToPrivateIdsVerified"] is False
    assert swap["automaticArchiveCorrectionWritten"] is False
    assert EVIDENCE["limitations"][
        "independentPrivateProviderIdToOfficialClubCrosswalkAccepted"
    ] is False
    assert EVIDENCE["limitations"][
        "technicalDayPatternPromotedToConfirmedPlayedGoalClassification"
    ] is False
    assert EVIDENCE["limitations"]["officialRevisionPlayedResultRecoveredFromPrivateArchive"
                                   ] is False
    assert EVIDENCE["limitations"]["homeAwayEvidenceProvesOriginalPublishedClock"] is False


def test_snapshot_access_remains_force_rls_and_no_api_grants():
    for item in EVIDENCE["databaseSecurity"].values():
        assert item == {
            "rlsEnabled": True,
            "forceRls": True,
            "anonSelect": False,
            "authenticatedSelect": False,
            "serviceRoleSelect": False,
        }


def test_public_aggregate_evidence_never_contains_match_rows_or_secret_fields():
    unsafe_fields = {
        "source_match_id", "home_team_id", "away_team_id", "sourceMatchId",
        "homeTeamId", "awayTeamId", "private_team_id", "access_token",
        "api_key", "password", "privateMatchIdentifier", "match_id",
        "model_bytes", "private_model_parameters",
    }

    def inspect(value):
        if isinstance(value, dict):
            assert unsafe_fields.isdisjoint(value)
            for item in value.values():
                inspect(item)
        elif isinstance(value, list):
            for item in value:
                inspect(item)

    inspect(EVIDENCE)
    limitations = EVIDENCE["limitations"]
    for key in (
        "matchSpecificTeamAndSourceIdsCompared",
        "sixDatesYieldSixIndependentlyVerifiedPrivateTechnicalAwards",
        "timeZonesCrossSourceIndependentlyValidated",
        "privateStatusPlayedVersusAwardedVerified",
        "databaseRowsReadIndividually",
        "privateMatchIdentifiersExported",
        "automaticQuarantineApplied",
        "privateSnapshotMutated",
        "protectedRealModelTrainingAuthorized",
        "historicalFirstPublicationVerified",
        "sealedHoldout2025_26Read",
        "publicPredictionsWritten",
    ):
        assert limitations[key] is False
