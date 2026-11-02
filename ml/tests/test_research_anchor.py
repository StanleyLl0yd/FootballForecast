"""Synthetic-only tests; no private database, publisher fetch or holdout."""
from dataclasses import replace

import pytest
from test_research_lock import freeze, report

from football_forecast.data.contracts import DataError
from football_forecast.research.anchor import build_study_anchor_request
from football_forecast.research.locking import _digest


@pytest.fixture(scope="module")
def lock():
    return freeze()


def request(lock, **changes):
    kwargs = dict(
        corroboration=report(),
        workflow_run_id=123456,
        workflow_job_id=234567,
        workflow_head_sha=getattr(lock, "code_sha", "b" * 40),
        runner_image_sha256="c" * 64,
        dependency_manifest_sha256="d" * 64,
        private_model_artifact_sha256="e" * 64,
    )
    kwargs.update(changes)
    return build_study_anchor_request(lock, **kwargs)


def test_request_is_deterministic_aggregate_only_and_never_authorizes_holdout(lock):
    first = request(lock)
    assert first == request(lock)
    assert first["kind"] == "M2_STUDY_ANCHOR_REQUEST"
    assert first["reviewState"] == "PENDING_INDEPENDENT_REVIEW"
    assert first["holdoutAccessAuthorized"] is False
    assert first["holdoutRead"] is False
    assert first["protectedRef"] == "refs/heads/main"
    assert first["trainingAttestationCanonicalSha256"] == _digest(lock.as_dict())
    assert first["workflowHeadSha"] == lock.code_sha
    assert "synthetic-" not in str(first)
    assert "CLUB_" not in str(first)
    assert "approved" not in str(first).lower()
    assert not any("2025/2026" in str(value) for value in first.values())


@pytest.mark.parametrize("changes", [
    {"workflow_run_id": True},
    {"workflow_job_id": 0},
    {"workflow_head_sha": "f" * 40},
    {"runner_image_sha256": "invalid"},
    {"dependency_manifest_sha256": "d" * 63},
    {"private_model_artifact_sha256": None},
])
def test_unpinned_job_environment_or_private_model_refused(lock, changes):
    with pytest.raises(DataError, match="unpinned"):
        request(lock, **changes)


def test_fake_approval_broken_train_scope_and_raw_candidate_refused(lock):
    for invalid in (
        replace(lock, holdout_read=True),
        replace(lock, historical_prematch_verified=True),
        replace(lock, research_classification="STRICT_AS_OF"),
        replace(lock, train_outcome_counts=(240, 240, 0)),
        replace(lock, training_matches=True),
    ):
        with pytest.raises(DataError, match="scope"):
            request(invalid)
    with pytest.raises(DataError, match="lock object"):
        request(lock.as_dict())


def test_stale_source_comparison_is_rejected(lock):
    comparator = report()
    comparator["footbolnoCsvSHA256"] = "f" * 64
    with pytest.raises(DataError, match="comparison"):
        request(lock, corroboration=comparator)
