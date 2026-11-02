"""Synthetic-only pre-holdout training-lock tests. Never read live records."""
from datetime import UTC, datetime, timedelta

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.locking import (
    REFERENCE_BLOB,
    prepare_pre_holdout_lock,
)

SNAPSHOT = "a0000000-0000-0000-0000-000000000001"
SHA = "a" * 64
COMMIT = "b" * 40
RETRIEVED = datetime(2026, 11, 1, tzinfo=UTC)


class SyntheticCursor:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def execute(self, sql, params):
        self.calls.append((sql, params))

    def fetchmany(self, n):
        assert n == 241
        return self.rows[:n]


def rows():
    result = []
    for h in range(16):
        for a in range(16):
            if h == a:
                continue
            dt = datetime(2024, 8, 1, tzinfo=UTC) + timedelta(days=len(result)//4)
            result.append((
                f"synthetic-{h}-{a}", "2024/2025", "train_baseline", dt,
                f"src-{h:02}", f"src-{a:02}", h % 3, a % 2,
                "finished", True, dt.date(), None, SHA, RETRIEVED,
            ))
    return sorted(result, key=lambda row: (row[3], row[0]))


def report():
    return {
        "season": "2024/2025",
        "kind": "M0_SOURCE_REPORTED_MATCH_BY_MATCH_CROSSCHECK",
        "footbolnoCsvSHA256": SHA,
        "openFootballGitBlob": REFERENCE_BLOB,
        "compared": 240, "referenceCount": 240,
        "matchedDirectedFixtures": 240, "missingFromPublisher": 0,
        "missingFromOpenFootball": 0, "dateSourceErrors": 0,
        "structuralSourceErrors": 0, "referenceAwardedGames": 0,
        "mismatchedFixtures": 0,
        "observedPublisherAndOpenFootballAgreement": True,
        "differingFields": {"date": 0, "homeGoals": 0, "awayGoals": 0, "resultType": 0},
    }


def mapping():
    return {f"src-{i:02}": f"CLUB_{i:02}" for i in range(16)}


def freeze(cursor=None, **changes):
    opts = dict(
        snapshot_id=SNAPSHOT, source_sha256=SHA, code_sha=COMMIT,
        club_mapping=mapping(), corroboration=report(),
    )
    opts.update(changes)
    return prepare_pre_holdout_lock(cursor or SyntheticCursor(rows()), **opts)


def test_deterministic_private_pre_holdout_attestation_contains_no_fixture_rows():
    lock = freeze()
    assert lock == freeze()
    public = lock.as_dict()
    assert public["trainingMatches"] == 240
    assert public["trainingClubs"] == 16
    assert sum(public["trainOutcomeCountsHDA"]) == 240
    assert public["holdoutRead"] is False
    assert public["modelAccuracyEvaluated"] is False
    assert public["historicalPrematchVerified"] is False
    assert public["researchClassification"] == "NON_STRICT_RETROSPECTIVE"
    for name in ("trainRowsSha256", "clubMappingSha256", "fittedModelSha256"):
        assert len(public[name]) == 64
    assert "synthetic-" not in str(public) and "src-0" not in str(public)


def test_hashes_react_to_train_scores_and_mapping_without_tuning():
    fixture_rows = rows()
    modified = list(fixture_rows[0])
    modified[6] = (modified[6] + 1) % 4
    fixture_rows[0] = tuple(modified)
    assert freeze(SyntheticCursor(fixture_rows)).train_rows_sha256 != freeze().train_rows_sha256
    alternate = {f"src-{i:02}": f"CLUB_{15-i:02}" for i in range(16)}
    assert freeze(club_mapping=alternate).club_mapping_sha256 != freeze().club_mapping_sha256
    assert freeze(code_sha="c" * 40).code_sha != freeze().code_sha


@pytest.mark.parametrize("mutation", [
    lambda x: x.update(compared=239),
    lambda x: x.update(footbolnoCsvSHA256="f"*64),
    lambda x: x.update(openFootballGitBlob="f"*40),
    lambda x: x.update(referenceAwardedGames=1),
    lambda x: x.update(observedPublisherAndOpenFootballAgreement=False),
    lambda x: x.update(mismatchedFixtures=1),
    lambda x: x["differingFields"].update(homeGoals=1),
    lambda x: x.update(season="2025/2026"),
    lambda x: x.update(compared=True),
])
def test_invalid_corroboration_refused_before_query(mutation):
    evidence = report()
    mutation(evidence)
    cursor = SyntheticCursor(rows())
    with pytest.raises(DataError, match="corroboration|comparison|disagreement"):
        freeze(cursor, corroboration=evidence)
    assert cursor.calls == []


def test_mapping_and_code_sha_are_fail_closed():
    for invalid in (
        {**mapping(), "src-00": "CLUB_01"},
        {**mapping(), "unknown": "UNUSED"},
        {key: "DUPLICATE" for key in mapping()},
        {key: key.lower() for key in mapping()},
    ):
        with pytest.raises(DataError, match="mapping"):
            freeze(club_mapping=invalid)
    cursor = SyntheticCursor(rows())
    with pytest.raises(DataError, match="Git commit"):
        freeze(cursor, code_sha="invalid")
    assert cursor.calls == []


def test_protected_input_rejects_holdout_row_even_with_valid_source_evidence():
    fixture_rows = rows()
    first = list(fixture_rows[0])
    first[2] = "sealed_holdout"
    fixture_rows[0] = tuple(first)
    with pytest.raises(DataError, match="non-training"):
        freeze(SyntheticCursor(fixture_rows))
