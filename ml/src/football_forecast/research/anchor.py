"""Pure M2 pre-anchor request envelope. No holdout authorization or I/O.

A syntactically valid request is not a protected Git anchor. A later trusted
runner must independently authenticate source bytes, job, environment, model
escrow and protected ancestry before the first sealed-label read.
"""
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.research.locking import (
    PROTOCOL,
    REFERENCE_BLOB,
    PreHoldoutLock,
    _check_corroboration,
    _digest,
)

_REPOSITORY = "StanleyLl0yd/FootballForecast"
_COMMIT = r"[a-f0-9]{40}"
_DIGEST = r"[a-f0-9]{64}"


def _sha(value: object, pattern: str) -> bool:
    return isinstance(value, str) and fullmatch(pattern, value) is not None


def build_study_anchor_request(
    lock: PreHoldoutLock,
    *,
    corroboration: object,
    workflow_run_id: int,
    workflow_job_id: int,
    workflow_head_sha: str,
    runner_image_sha256: str,
    dependency_manifest_sha256: str,
    private_model_artifact_sha256: str,
) -> dict[str, object]:
    """Build unapproved aggregate-only metadata for an external review.

    No value returned by this function can authenticate or grant permission to
    read the sealed holdout. The trusted executor must attest the supplied
    identities against protected GitHub job logs and privately stored bytes.
    """
    if type(lock) is not PreHoldoutLock:
        raise DataError("M2 pre-anchor: source-corroborated lock object required")
    counts = lock.train_outcome_counts
    if (lock.protocol != PROTOCOL or lock.research_classification != "NON_STRICT_RETROSPECTIVE"
            or lock.holdout_read is not False or lock.historical_prematch_verified is not False
            or type(lock.training_matches) is not int or lock.training_matches != 240
            or type(lock.training_clubs) is not int or lock.training_clubs != 16
            or not isinstance(counts, tuple) or len(counts) != 3
            or any(type(n) is not int or n < 0 or n > 240 for n in counts)
            or sum(counts) != 240):
        raise DataError("M2 pre-anchor: invalid unapproved train-only scope")
    if (not _sha(lock.code_sha, _COMMIT)
            or not all(_sha(getattr(lock, field), _DIGEST) for field in (
                "source_sha256", "snapshot_identity_sha256", "train_rows_sha256",
                "club_mapping_sha256", "fitted_model_sha256",
            ))):
        raise DataError("M2 pre-anchor: invalid evidence fingerprint")
    _check_corroboration(corroboration, lock.source_sha256)
    if (type(workflow_run_id) is not int or workflow_run_id <= 0
            or type(workflow_job_id) is not int or workflow_job_id <= 0
            or workflow_head_sha != lock.code_sha
            or not all(_sha(value, _DIGEST) for value in (
                runner_image_sha256, dependency_manifest_sha256,
                private_model_artifact_sha256,
            ))):
        raise DataError("M2 pre-anchor: unpinned execution or model evidence")

    return {
        "schemaVersion": 1,
        "kind": "M2_STUDY_ANCHOR_REQUEST",
        "reviewState": "PENDING_INDEPENDENT_REVIEW",
        "holdoutAccessAuthorized": False,
        "holdoutRead": False,
        "researchClassification": "NON_STRICT_RETROSPECTIVE",
        "repository": _REPOSITORY,
        "protectedRef": "refs/heads/main",
        "protocol": PROTOCOL,
        "codeSha": lock.code_sha,
        "sourceSha256": lock.source_sha256,
        "openFootballReferenceBlob": REFERENCE_BLOB,
        "snapshotIdentitySha256": lock.snapshot_identity_sha256,
        "trainRowsSha256": lock.train_rows_sha256,
        "clubMappingSha256": lock.club_mapping_sha256,
        "fittedModelSha256": lock.fitted_model_sha256,
        "trainingAttestationCanonicalSha256": _digest(lock.as_dict()),
        "sourceComparisonCanonicalSha256": _digest(corroboration),
        "workflowRunId": workflow_run_id,
        "workflowJobId": workflow_job_id,
        "workflowHeadSha": workflow_head_sha,
        "runnerImageSha256": runner_image_sha256,
        "dependencyManifestSha256": dependency_manifest_sha256,
        "privateModelArtifactSha256": private_model_artifact_sha256,
    }
