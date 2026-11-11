"""M4 model lock: reproducible *synthetic* 1673-row training and refusal."""
from dataclasses import replace
from hashlib import sha256
from math import isfinite

import pytest
from test_rpl_development_folds import synthetic_corpus

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_private_candidate import (
    MODEL_VERSION,
    SourceSnapshot,
    fit_private_shadow_candidate,
    private_candidate_distribution,
)
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS


def _snapshot_manifest() -> tuple[SourceSnapshot, ...]:
    return tuple(
        SourceSnapshot(
            s,
            sha256(("source-" + s).encode()).hexdigest(),
            sha256(("rows-" + s).encode()).hexdigest(),
        )
        for s in DEVELOPMENT_SEASONS
    )


def _synthetic_eligible():
    # Fictional topology matching reviewed historical 26 distinct club IDs,
    # 16 per season, adjacent overlap 14/14/14/13/14/13.
    original = synthetic_corpus()
    aliases = list(range(16))
    updates = {
        1: {14: 16, 15: 17},
        2: {12: 18, 13: 19},
        3: {10: 20, 11: 21},
        4: {8: 22, 9: 23, 11: 24},
        5: {6: 25, 7: 14},
        6: {4: 13, 5: 15, 10: 21},
    }
    exclusions = (0, 4, 2, 0, 1, 0, 0)
    result = []
    for i, season in enumerate(DEVELOPMENT_SEASONS):
        for index, club in updates.get(i, {}).items():
            aliases[index] = club
        year = [row for row in original if row.season == season]
        assert len(year) == 240
        for row in year[exclusions[i]:]:
            h = int(row.home_team_id.removeprefix("club_"))
            a = int(row.away_team_id.removeprefix("club_"))
            result.append(replace(
                row,
                home_team_id=f"club_{aliases[h]}",
                away_team_id=f"club_{aliases[a]}",
            ))
    assert len(result) == 1673
    assert len(set([team for r in result for team in
                    (r.home_team_id, r.away_team_id)])) == 26
    return tuple(result)


@pytest.fixture(scope="module")
def corpus():
    return _synthetic_eligible()


@pytest.fixture(scope="module")
def model(corpus):
    return fit_private_shadow_candidate(corpus, _snapshot_manifest())


def test_frozen_model_matches_m3_parameters_and_no_holdout(model):
    assert MODEL_VERSION == "m4-team-poisson-shrink12-shadow-v1"
    assert model.eligible_matches == 1673
    assert model.distinct_clubs == 26
    assert model.classification == "NON_STRICT_RETROSPECTIVE"
    assert model.state == "SHADOW_CANDIDATE_UNAPPROVED"
    assert model.production_approved is False
    assert model.public_forecasts_authorized is False
    assert model.holdout_2025_26_read is False
    assert sha256(model.artifact_bytes).hexdigest() == model.artifact_sha256
    assert len(model.artifact_bytes) < 32768
    assert len(model.source_manifest_sha256) == 64


def test_private_distribution_is_normalized_without_unseen_identity(model):
    outcome = private_candidate_distribution(model, "club_0", "club_1")
    outcome.validate()
    assert sum((outcome.home_win, outcome.draw, outcome.away_win)) == pytest.approx(1)
    assert all(isfinite(x) and x > 0 for x in (
        outcome.expected_home, outcome.expected_away,
    ))
    with pytest.raises(DataError, match="ABSTAIN"):
        private_candidate_distribution(model, "unreviewed", "club_1")
    with pytest.raises(DataError, match="ABSTAIN"):
        private_candidate_distribution(model, "club_0", "club_0")


def test_input_permutation_is_stable(corpus, model):
    rev = fit_private_shadow_candidate(tuple(reversed(corpus)), _snapshot_manifest())
    assert rev == model


def test_historical_played_score_change_changes_artifact(corpus, model):
    first = corpus[10]
    altered = (corpus[:10] + (replace(first, home_goals=19),) + corpus[11:])
    other = fit_private_shadow_candidate(altered, _snapshot_manifest())
    assert other.artifact_sha256 != model.artifact_sha256
    assert other.eligible_rows_sha256 != model.eligible_rows_sha256


@pytest.mark.parametrize("changes", [
    {"season": "2025/26"}, {"status": "awarded"},
    {"result_kind": "awarded"}, {"result_kind": "unverified"},
    {"home_goals": -1}, {"away_goals": 21},
    {"home_team_id": "club_999"},
])
def test_refuses_invalid_heldout_unplayed_and_unknown_teams(corpus, changes):
    modified = (replace(corpus[0], **changes), *corpus[1:])
    with pytest.raises(DataError):
        fit_private_shadow_candidate(modified, _snapshot_manifest())


def test_incomplete_duplicates_and_wrong_container_fail(corpus):
    for bad in (corpus[:-1], corpus[:-2] + corpus[:2], list(corpus)):
        with pytest.raises(DataError):
            fit_private_shadow_candidate(bad, _snapshot_manifest())


def test_manifest_rejects_reordered_bad_and_identical_hashes(corpus):
    manifest = _snapshot_manifest()
    for bad in (
        tuple(reversed(manifest)),
        (replace(manifest[0], source_sha256="bad"), *manifest[1:]),
        (replace(manifest[0], normalized_sha256=manifest[0].source_sha256),
         *manifest[1:]),
    ):
        with pytest.raises(DataError):
            fit_private_shadow_candidate(corpus, bad)


def test_source_digest_change_changes_locked_artifact(corpus, model):
    manifest = _snapshot_manifest()
    altered = (replace(manifest[0], source_sha256="f" * 64), *manifest[1:])
    assert (fit_private_shadow_candidate(corpus, altered).artifact_sha256
            != model.artifact_sha256)


def test_no_output_can_be_claimed_public_or_authenticated_as_of(model):
    assert b'"productionApproved":false' in model.artifact_bytes
    assert b'"publicForecastsAuthorized":false' in model.artifact_bytes
    assert b'"holdout2025_26Read":false' in model.artifact_bytes
    assert b'"classification":"NON_STRICT_RETROSPECTIVE"' in model.artifact_bytes
