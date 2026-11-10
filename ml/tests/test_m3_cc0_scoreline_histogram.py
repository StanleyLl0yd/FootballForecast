"""Synthetic parser and denial regression for the M3-A3 histogram evidence."""
import json
from copy import deepcopy
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_cc0_scoreline_histogram import (
    audit_scoreline_histogram_receipt,
    public_scoreline_histogram,
)

EVIDENCE = Path(__file__).resolve().parents[2] / (
    "docs/M3_FIVE_SEASON_CC0_SCORELINE_HISTOGRAM_EVIDENCE.json"
)


def _source():
    return json.loads(EVIDENCE.read_text(encoding="utf-8"))


def test_five_season_receipt_never_promotes_private_rows_to_training():
    report = audit_scoreline_histogram_receipt(_source())
    assert report.public_score_rows_compared == 1200
    assert report.private_rows_in_aggregate == 1200
    assert report.exact_histogram_seasons == 4
    assert report.public_direction_hypothesis_removes_one_marginal_discrepancy
    assert report.independent_private_played_labels == 0
    assert not report.real_training_authorized


def test_public_json_parser_discards_names_and_keeps_awarded_score_shapes():
    fake = {"name": "SYNTHETIC", "matches": [
        {"team1": "FAKE_A", "team2": "FAKE_B", "status": "awarded",
         "score": {"ft": [1, 2]}}
        for _ in range(240)
    ]}
    histogram = public_scoreline_histogram(json.dumps(fake), "JSON")
    assert histogram == {(1, 2): 240}
    assert "FAKE_A" not in repr(histogram)


def test_public_football_txt_parser_handles_blank_clock_fields():
    fake = "\n".join(
        "  Synthetic Club A       v Synthetic Club B       2-1 (0-1)"
        for _ in range(240)
    )
    assert public_scoreline_histogram(fake, "FOOTBALL_TXT") == {(2, 1): 240}


@pytest.mark.parametrize("raw,fmt", [
    ("", "JSON"),
    ("not valid", "JSON"),
    ('{"matches":[]}', "JSON"),
    ('{"matches":[{"score":{"ft":[1,2]}}]}', "JSON"),
    ('{"matches":null}', "JSON"),
    ('{"matches":[null]}', "JSON"),
    ("no fixtures at all", "FOOTBALL_TXT"),
    ("Home v Away no final score", "FOOTBALL_TXT"),
    ("a", "CSV"),
])
def test_reject_missing_or_malformed_public_source(raw, fmt):
    with pytest.raises(DataError, match="M3 scoreline histogram"):
        public_scoreline_histogram(raw, fmt)


@pytest.mark.parametrize("invalid", [
    [-1, 1], [1, 21], [True, 0], [1.1, 0], ["1", 0], [None, 0],
    [1], [1, 0, 0],
])
def test_refuse_malformed_goal_value_even_if_other_rows_are_valid(invalid):
    fake = {"matches": [{"score": {"ft": [0, 0]}} for _ in range(240)]}
    fake["matches"][19]["score"]["ft"] = invalid
    with pytest.raises(DataError):
        public_scoreline_histogram(json.dumps(fake), "JSON")


@pytest.mark.parametrize("path,key,replacement", [
    ("root", "schemaVersion", True),
    ("root", "kind", "FAKE"),
    ("root", "scope", "PRODUCTION"),
    ("root", "sourceInventory", "UNPINNED"),
    ("aggregate", "exactHistogramMatchSeasons", 5),
    ("aggregate", "publicRowsCompared", 1680),
    ("aggregate", "originalHistogramL1Total", 0),
    ("aggregate", "independentlyCertifiedEligiblePrivateRows", 1200),
    ("limitations", "privateIdsExported", True),
    ("limitations", "privateRowsExported", True),
    ("limitations", "privateSourceScoreBinsExported", True),
    ("limitations", "eachFixtureIndependentlyMatched", True),
    ("limitations", "playedVersusAwardedStatusVerified", True),
    ("limitations", "sourceFirstPublicationUtcVerified", True),
    ("limitations", "realTrainingAuthorized", True),
    ("limitations", "holdout2025_26Read", True),
])
def test_edited_scope_or_false_gates_rejected(path, key, replacement):
    evidence = _source()
    target = evidence if path == "root" else evidence[path]
    target[key] = replacement
    with pytest.raises(DataError):
        audit_scoreline_histogram_receipt(evidence)


@pytest.mark.parametrize("index,key,replacement", [
    (0, "publicDistinctScorelineBins", 24),
    (1, "sourceDeclaredCC0", False),
    (2, "underlyingRecordProvenanceVerified", True),
    (3, "histogramL1Difference", 0),
    (3, "differingScorelineBins", 0),
    (3, "gitBlobSha", "0000000000000000000000000000000000000000"),
    (4, "privateRows", 239),
])
def test_public_source_pin_or_count_mutation_rejected(index, key, replacement):
    evidence = _source()
    evidence["seasons"][index][key] = replacement
    with pytest.raises(DataError):
        audit_scoreline_histogram_receipt(evidence)


def test_known_public_anomaly_is_hypothesis_not_repair():
    evidence = _source()
    mutated = deepcopy(evidence)
    mutated["hypotheticalPublicArchiveDirectionCorrection"][
        "privateRowsWereModified"
    ] = True
    with pytest.raises(DataError):
        audit_scoreline_histogram_receipt(mutated)
    mutated = deepcopy(evidence)
    mutated["hypotheticalPublicArchiveDirectionCorrection"][
        "hypotheticalSinglePublicResultReorientationL1"
    ] = 2
    with pytest.raises(DataError):
        audit_scoreline_histogram_receipt(mutated)


def test_unknown_fields_cannot_smuggle_private_identifiers():
    evidence = _source()
    evidence["seasons"][0]["privateTeamId"] = "SYNTHETIC_SECRET"
    with pytest.raises(DataError):
        audit_scoreline_histogram_receipt(evidence)
