"""Owner-only private PRE-HOLDOUT roster preflight, metadata and TRAIN rows only.

This worker does not read 2025/26 matches, source-match identities, goal
labels or sealed score tables; does not fit, tune, publish or approve a model.
The GitHub Actions caller must authenticate protected main and TLS root.
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import PROTOCOL
from football_forecast.research.locking import _digest
from football_forecast.research.openfootball_crosswalk import (
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
    prepare_official_roster_crosswalk,
)
from football_forecast.research.openfootball_escrow import _private_connection

_PINNED_SOURCE_SHA = "038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f"
_PINNED_CROSSWALK_SHA = "99ad249ceae34aa8fd12d77be8e4b58ad8b80ec87b169021b5ca962d176080b2"
_PINNED_SNAPSHOT_SHA = "afe82bbf33d6e547403ef1ce9505493a655661e0e0f78dffecaea9e857f5b191"
_EXPECTED_ESCROW = {
    "code_sha": "a89c82ed02b1157ca935c573f25c93544ba299f1",
    "source_sha256": "f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb",
    "train_rows_sha256": "fe00ba5cec8a9762a8564f1e76700233bf770ca766e020a0b44616c7d2aecc38",
    "club_mapping_sha256": "3f10e2bd77f348b570036efc8827f0571a26cae55c7dcb4ad93b5a39710e631b",
    "fitted_model_sha256": "987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d",
    "model_artifact_sha256": "5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d",
    "training_matches": 240,
    "training_clubs": 16,
    "research_state": "TRAIN_ONLY_UNAPPROVED",
    "holdout_read": False,
    "model_approved": False,
}

# All SQL is bounded, static, and refers to TRAIN 2024/25 and aggregate metadata.
# Never add a query to 2025/26 (even a score count) to this preflight worker.
_SQL_SNAPSHOT = """
select id::text, source_sha256, retrieved_at
from ff_private.ff_ingest_snapshots
where source_sha256 = %s
"""
_SQL_TRAIN = """
select home_source_id as team_id, home_name as team_name
from ff_private.ff_ingest_matches
where snapshot_id=%s::uuid and season='2024/2025' and dataset_role='train_baseline'
union
select away_source_id as team_id, away_name as team_name
from ff_private.ff_ingest_matches
where snapshot_id=%s::uuid and season='2024/2025' and dataset_role='train_baseline'
"""
_SQL_ESCROW = """
select code_sha, source_sha256, train_rows_sha256, club_mapping_sha256,
       fitted_model_sha256, model_artifact_sha256, training_matches,
       training_clubs, research_state, holdout_read, model_approved
from ff_private.ff_m2_training_model_escrow
where protocol='m2-openfootball-calendar-v1'
"""


def build_preflight_receipt(
    *, train_pairs: tuple[tuple[str, str], ...],
    model_escrow: dict[str, object],
    snapshot_id: str,
    snapshot_sha256: str,
    retrieved_at: datetime,
    code_sha: str,
) -> dict[str, object]:
    """Pure attestable metadata, no information read outside supplied TRAIN rows.

    The returned receipt cannot itself grant a holdout access permission.
    """
    if type(code_sha) is not str or not fullmatch(r"[a-f0-9]{40}", code_sha):
        raise DataError("M2 roster preflight: invalid protected main")
    if type(model_escrow) is not dict or model_escrow != _EXPECTED_ESCROW:
        raise DataError("M2 roster preflight: private model escrow metadata drift")
    if (type(snapshot_id) is not str
            or not fullmatch(r"[a-f0-9]{8}-[a-f0-9-]{27}", snapshot_id)
            or snapshot_sha256 != _PINNED_SOURCE_SHA
            or type(retrieved_at) is not datetime
            or retrieved_at.tzinfo is None
            or retrieved_at.utcoffset() is None
            or retrieved_at.utcoffset().total_seconds() != 0):
        raise DataError("M2 roster preflight: invalid private snapshot metadata")
    identity = _digest([snapshot_id, snapshot_sha256, retrieved_at.isoformat()])
    if identity != _PINNED_SNAPSHOT_SHA:
        raise DataError("M2 roster preflight: private snapshot identity mismatch")
    model_aliases = tuple(sorted(
        _train_alias(name)
        for name in TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL.values()
    ))
    crosswalk = prepare_official_roster_crosswalk(
        train_source_pairs=train_pairs,
        model_team_aliases=model_aliases,
    )
    if crosswalk.sha256 != _PINNED_CROSSWALK_SHA:
        raise DataError("M2 roster preflight: real TRAIN mapping differs from preregistration")
    return {
        "schemaVersion": 1,
        "kind": "M2_PROTECTED_PREHOLDOUT_ROSTER_PREFLIGHT",
        "protocol": PROTOCOL,
        "codeSha": code_sha,
        "trainOnlyClubCount": 16,
        "returningClubCount": 14,
        "unseenClubCount": 2,
        "trainAliasSetSha256": _EXPECTED_ESCROW["club_mapping_sha256"],
        "trainModelArtifactSha256": _EXPECTED_ESCROW["model_artifact_sha256"],
        "trainFittedModelSha256": _EXPECTED_ESCROW["fitted_model_sha256"],
        "privateHoldoutSnapshotIdentitySha256": identity,
        "candidateCrosswalkSha256": crosswalk.sha256,
        "realPrivateTrainMetadataVerified": True,
        "externalHoldoutSourceRechecked": False,
        "holdoutRead": False,
        "modelApproved": False,
        "immutableStudyLockApproved": False,
        "holdoutEvaluationPermitted": False,
        "productionForecastsWritten": 0,
    }


def run_read_only_preflight(code_sha: str) -> dict[str, object]:
    """Uses an existing privileged role, but changes the transaction to READ ONLY."""
    with _private_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("set transaction read only")
            cursor.execute("set local statement_timeout = '12000ms'")
            cursor.execute("set local lock_timeout = '3000ms'")
            cursor.execute(_SQL_SNAPSHOT, (_PINNED_SOURCE_SHA,))
            snapshots = cursor.fetchall()
            if len(snapshots) != 1:
                raise DataError("M2 roster preflight: pinned source snapshot ambiguous")
            snapshot_id, source_sha, retrieved_at = snapshots[0]
            cursor.execute(_SQL_TRAIN, (snapshot_id, snapshot_id))
            train_pairs = tuple(cursor.fetchall())
            if len(train_pairs) != 16:
                raise DataError("M2 roster preflight: train club metadata incomplete")
            cursor.execute(_SQL_ESCROW)
            records = cursor.fetchall()
            if len(records) != 1:
                raise DataError("M2 roster preflight: expected one private model")
            keys = tuple(_EXPECTED_ESCROW)
            model_escrow = dict(zip(keys, records[0], strict=True))
            return build_preflight_receipt(
                train_pairs=train_pairs, model_escrow=model_escrow,
                snapshot_id=snapshot_id, snapshot_sha256=source_sha,
                retrieved_at=retrieved_at, code_sha=code_sha,
            )


def main() -> None:
    try:
        code_sha = os.environ.get("GITHUB_SHA", "")
        if (os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
                or os.environ.get("GITHUB_REF") != "refs/heads/main"
                or not fullmatch(r"[a-f0-9]{40}", code_sha)):
            raise DataError("M2 roster preflight: untrusted executing revision")
        # The already reviewed public evidence is a bound, not provider data.
        evidence_path = Path("docs/M2_OFFICIAL_2025_26_ROSTER_EVIDENCE.json")
        if evidence_path.is_symlink() or not evidence_path.is_file():
            raise DataError("M2 roster preflight: roster proof not pinned")
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
        aggregate = evidence["trainOnlyLiveAggregate"]
        pending = evidence["preHoldoutMetadataCommitmentCandidate"]
        if (evidence["kind"] != "M2_OFFICIAL_2025_26_PRESEASON_ROSTER_GATE"
                or pending["candidateCrosswalkSha256"] != _PINNED_CROSSWALK_SHA
                or pending["sealedSourceSnapshotIdentitySha256"]
                != _PINNED_SNAPSHOT_SHA
                or pending["sealedMatchRowsRead"] != 0
                or pending["immutableStudyLockApproved"] is not False
                or aggregate["modelAliasListSha256"]
                != _EXPECTED_ESCROW["club_mapping_sha256"]
                or evidence["holdoutRead"] is not False
                or evidence["studyLockApproved"] is not False):
            raise DataError("M2 roster preflight: source evidence mismatch")
        receipt = run_read_only_preflight(code_sha)
        print(json.dumps(
            receipt, sort_keys=True, separators=(",", ":"), allow_nan=False,
        ))
    except Exception:
        print("FAIL: M2 private TRAIN roster preflight rejected; no identifiers logged",
              file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
