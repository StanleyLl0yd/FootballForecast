#!/usr/bin/env python3
"""Protected SELECT-only M4 7-season fit. Only bounded digest receipt is emitted.

No 2025/26 access, provider fixture export, public model or DB mutation.
The full private model stays in process memory and is discarded until A4
reviewed private model storage is available and independently authorized.
"""
import os
import sys
import re
from collections import Counter
from datetime import timezone
from json import dumps

# Authenticated owner-only write is a distinct explicit operation.
# Hash previously observed by the original 2026-11-11 SELECT-only owner run.
FROZEN_M4_ARTIFACT_SHA256 = "b3eeb4cf950c38507572c6c6b4e3db7f133cf7cc2ee0593b2d940c66394b0a0c"
STORE_MARKER = "M4_PRIVATE_MODEL_STORE_EXPLICIT"

from football_forecast.data.contracts import DataError
from football_forecast.research.m4_private_candidate import (
    SourceSnapshot, fit_private_shadow_candidate,
)
from football_forecast.research.rpl_development_folds import plan_expanding_development_folds
from football_forecast.research.rpl_temporal_features import (
    DEVELOPMENT_SEASONS, DevelopmentMatch,
)

EXCLUSIONS = frozenset({
    ("2019/20", "2020-06-27", 0, 3),
    ("2019/20", "2020-07-01", 0, 3),
    ("2019/20", "2020-07-16", 3, 0),
    ("2019/20", "2020-07-22", 3, 0),
    ("2020/21", "2020-09-13", 0, 3),
    ("2020/21", "2020-09-19", 3, 0),
    ("2022/23", "2023-03-19", 0, 3),
})
SNAPSHOTS_SQL = """
SELECT season, source_responses_sha256, normalized_rows_sha256,
       source_name, model_training_approved, holdout_read
FROM ff_private.ff_rpl_history_snapshots
WHERE season IN (
 '2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'
)
ORDER BY season;
"""
MATCHES_SQL = """
SELECT s.season,m.source_match_id,m.kickoff_at,m.home_team_id,m.away_team_id,
       m.home_goals,m.away_goals,m.status
FROM ff_private.ff_rpl_history_snapshots s
JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
WHERE s.season IN (
 '2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'
)
ORDER BY s.season,m.kickoff_at,m.source_match_id;
"""


def inspect_private_cohort(snapshot_rows, match_rows):
    if len(snapshot_rows) != 7 or len(match_rows) != 1680:
        raise DataError("M4: incomplete private historic source")
    if any(
        row[0] != season or row[3] != "OpenFoot Starter"
        or row[4] is not False or row[5] is not False
        for row, season in zip(snapshot_rows, DEVELOPMENT_SEASONS, strict=True)
    ):
        raise DataError("M4: unexpected historic snapshot provenance")
    snapshots = tuple(
        SourceSnapshot(season, source, normalized)
        for season, source, normalized, _, _, _ in snapshot_rows
    )
    full = tuple(
        DevelopmentMatch(
            season=season,
            source_match_id=match_id,
            kickoff_at=kickoff.astimezone(timezone.utc),
            home_team_id=home, away_team_id=away,
            home_goals=int(hg), away_goals=int(ag), status=status,
            result_kind="played",
        )
        for season, match_id, kickoff, home, away, hg, ag, status in match_rows
    )
    # Strict snapshot-level topology: 7 × 240, fixed seasons, 16 clubs,
    # 30 directed rounds, dates and ID continuity. These are provider rows,
    # NOT historical original as-of or independent played-goal proof.
    plan_expanding_development_folds(full)
    seen_exclusions = Counter()
    selected = []
    for row in full:
        key = (row.season, row.kickoff_at.strftime("%Y-%m-%d"),
               row.home_goals, row.away_goals)
        if key in EXCLUSIONS:
            seen_exclusions[key] += 1
        else:
            selected.append(row)
    if set(seen_exclusions) != EXCLUSIONS or any(n != 1 for n in seen_exclusions.values()):
        raise DataError("M4: seven approved exceptions not unique or missing")
    model = fit_private_shadow_candidate(tuple(selected), snapshots)
    if model.eligible_matches != 1673 or model.distinct_clubs != 26:
        raise DataError("M4: expected locked development-only cohort")
    return model



def persist_private_candidate(cursor, candidate, *, run_id: int, code_sha: str) -> bool:
    """One irreversible owner-only private model insert. No artifact export."""
    if candidate.artifact_sha256 != FROZEN_M4_ARTIFACT_SHA256:
        raise DataError("M4: source/model artifact differs from frozen original")
    if type(run_id) is not int or not 0 < run_id < 2**63:
        raise DataError("M4: invalid owner workflow run identifier")
    if type(code_sha) is not str or re.fullmatch(r"[0-9a-f]{40}", code_sha) is None:
        raise DataError("M4: untrusted owner workflow source revision")
    cursor.execute(
        """INSERT INTO ff_private.ff_m4_candidate_models
           (model_version,training_scope,training_matches,distinct_clubs,
            source_manifest_sha256,eligible_rows_sha256,model_sha256,
            model_bytes,code_sha,github_run_id)
           VALUES (%s,'2018/19-2024/25-development-only',%s,%s,%s,%s,%s,%s,%s,%s)
           ON CONFLICT (model_sha256) DO NOTHING
           RETURNING id""",
        (candidate.model_version, candidate.eligible_matches, candidate.distinct_clubs,
         candidate.source_manifest_sha256, candidate.eligible_rows_sha256,
         candidate.artifact_sha256, candidate.artifact_bytes, code_sha, run_id),
    )
    inserted = cursor.fetchone() is not None
    # A retry may find the exact frozen model, but must not modify or reinsert it.
    cursor.execute(
        """SELECT source_manifest_sha256,eligible_rows_sha256,model_sha256,
                  model_version,training_matches,distinct_clubs,
                  production_approved,public_release_allowed,holdout_2025_26_read,
                  octet_length(model_bytes),encode(sha256(model_bytes),'hex')
           FROM ff_private.ff_m4_candidate_models
           WHERE model_sha256=%s""", (candidate.artifact_sha256,),
    )
    row = cursor.fetchone()
    if row != (
        candidate.source_manifest_sha256, candidate.eligible_rows_sha256,
        candidate.artifact_sha256, candidate.model_version,
        candidate.eligible_matches, candidate.distinct_clubs,
        False, False, False,
        len(candidate.artifact_bytes), candidate.artifact_sha256,
    ):
        raise DataError("M4: private persisted artifact mismatch")
    return inserted


def main() -> None:
    if (
        os.environ.get("GITHUB_REPOSITORY") != "StanleyLl0yd/FootballForecast"
        or os.environ.get("GITHUB_REF") != "refs/heads/main"
        or os.environ.get("GITHUB_ACTOR") != "StanleyLl0yd"
    ):
        raise RuntimeError("unauthorized repository/ref/actor")
    mode = os.environ.get("M4_PRIVATE_MODEL_STORE")
    if mode is not None and mode != STORE_MARKER:
        raise RuntimeError("M4: unrecognized private operation")
    persist = mode == STORE_MARKER
    if persist and os.environ.get("GITHUB_EVENT_NAME") not in (
        "workflow_dispatch", "issue_comment",
    ):
        raise RuntimeError("M4: storage requires owner-triggered authenticated event")
    if persist and os.environ.get("M4_STORE_GATED") != "true":
        raise RuntimeError("M4: missing owner workflow storage gate")
    if persist and os.environ.get("GITHUB_SHA", "").lower() == "":
        raise RuntimeError("M4: source SHA missing")
    import psycopg  # Only within protected workflow; never imported in pure tests.

    with psycopg.connect(
        host=os.environ["PGHOST"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"],
        sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
        connect_timeout=10,
        options=("-c statement_timeout=120000" if persist else
                 "-c default_transaction_read_only=on -c statement_timeout=120000"),
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ" +
                ("" if persist else " READ ONLY")
            )
            cursor.execute(SNAPSHOTS_SQL)
            snapshots = cursor.fetchall()
            cursor.execute(MATCHES_SQL)
            matches = cursor.fetchall()
            candidate = inspect_private_cohort(snapshots, matches)
            if candidate.artifact_sha256 != FROZEN_M4_ARTIFACT_SHA256:
                raise DataError("M4: source differs from previously locked SHA")
            if persist:
                persist_private_candidate(
                    cursor, candidate,
                    run_id=int(os.environ["GITHUB_RUN_ID"]),
                    code_sha=os.environ["GITHUB_SHA"],
                )
                connection.commit()
            else:
                connection.rollback()
    # Bound to the protected HEAD and do not print model bytes, coefficients,
    # IDs, exact scores, any per-match data or secrets.
    receipt = {
        "schemaVersion": 1,
        "kind": ("M4_PRIVATE_SHADOW_CANDIDATE_ESCROW" if persist else
                 "M4_PRIVATE_SHADOW_CANDIDATE_SELECT_ONLY"),
        "codeSha": os.environ["GITHUB_SHA"],
        "sourceManifestSha256": candidate.source_manifest_sha256,
        "eligibleRowsSha256": candidate.eligible_rows_sha256,
        "modelArtifactSha256": candidate.artifact_sha256,
        "historicalSeasons": 7,
        "eligibleMatches": candidate.eligible_matches,
        "excluded": 7,
        "distinctClubs": candidate.distinct_clubs,
        "classification": candidate.classification,
        "artifactPersisted": persist,
        "modelApproved": False,
        "holdoutRead": False,
        "publicForecastsWritten": False,
    }
    print(dumps(receipt, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("FAIL: private M4 candidate receipt not available", file=sys.stderr)
        sys.exit(2)
