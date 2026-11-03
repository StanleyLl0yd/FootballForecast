"""Synthetic-only tests for independent 7-season private archival gate."""
import json
from hashlib import sha256

import pytest

from football_forecast.research.openfoot_history_store import (
    SEASONS,
    ArchiveError,
    canonical_json,
    validate_archive,
)


def fixture():
    rows = []
    for season in SEASONS:
        year = int(season[:4])
        for home in range(16):
            for away in range(16):
                if home == away:
                    continue
                base = {
                    "season": season,
                    "source_match_id": f"synthetic_{year}_{home}_{away}",
                    "home_team_id": f"club_{home}",
                    "away_team_id": f"club_{away}",
                    "kickoff_at": f"{year}-09-15T16:00:00Z",
                    "home_goals": home % 4,
                    "away_goals": away % 3,
                }
                rows.append({
                    **base,
                    "normalized_row_sha256": sha256(canonical_json(base)).hexdigest(),
                })
    rows.sort(key=lambda row: (row["season"], row["source_match_id"]))
    data = b"\n".join(map(canonical_json, rows)) + b"\n"
    snapshots = []
    for season in SEASONS:
        season_bytes = b"\n".join(canonical_json(r) for r in rows if r["season"] == season) + b"\n"
        snapshots.append({
            "season": season, "rows": 240,
            "sourceResponsesSha256": "b" * 64,
            "normalizedRowsSha256": sha256(season_bytes).hexdigest(),
        })
    manifest = {
        "schemaVersion": 1,
        "kind": "M2_OPENFOOT_PRIVATE_RPL_HISTORY_ARCHIVE",
        "sourceId": "openfoot_starter",
        "sourceTermsUrl": "https://openfootapi.com/terms",
        "researchState": "SOURCE_ARCHIVE_ONLY_UNAPPROVED",
        "codeSha": "a" * 40,
        "githubRunId": 123456789,
        "retrievedAtUtc": "2026-11-03T16:00:00Z",
        "sourceResponsesSha256": "b" * 64,
        "normalizedSha256": sha256(data).hexdigest(),
        "seasons": 7,
        "matches": 1680,
        "developmentSeasons": list(SEASONS),
        "seasonSnapshots": snapshots,
        "rightsState": "OWNER_PRIVATE_RESEARCH_UNRESOLVED",
        "strictPrematchProvenanceVerified": False,
        "modelTrainingApproved": False,
        "holdoutRead": False,
        "publicRowsWritten": 0,
    }
    return manifest, data


def test_full_synthetic_corpus_is_accepted_with_sealed_holdout():
    manifest, data = fixture()
    rows = validate_archive(manifest, data)
    assert len(rows) == 1680
    assert rows[0]["season"] == "2018/19"
    assert rows[-1]["season"] == "2024/25"
    assert "2025/26" not in {r["season"] for r in rows}
    assert manifest["holdoutRead"] is False


def test_rejects_corruption_extra_fields_and_training_approval():
    manifest, data = fixture()
    with pytest.raises(ArchiveError):
        validate_archive(manifest, data[:-1] + b"!")
    manifest, data = fixture()
    manifest["modelTrainingApproved"] = True
    with pytest.raises(ArchiveError):
        validate_archive(manifest, data)
    manifest, data = fixture()
    manifest["unexpectedSecret"] = "secret"
    with pytest.raises(ArchiveError):
        validate_archive(manifest, data)


def test_rejects_sealed_season_even_with_recomputed_checksums():
    manifest, data = fixture()
    rows = [json.loads(line) for line in data.splitlines()]
    rows[0]["season"] = "2025/26"
    base = {k: v for k, v in rows[0].items() if k != "normalized_row_sha256"}
    rows[0]["normalized_row_sha256"] = sha256(canonical_json(base)).hexdigest()
    tampered = b"\n".join(map(canonical_json, rows)) + b"\n"
    manifest["normalizedSha256"] = sha256(tampered).hexdigest()
    with pytest.raises(ArchiveError):
        validate_archive(manifest, tampered)


def test_rejects_invalid_goal_even_with_new_row_digest_and_batch_digest():
    manifest, data = fixture()
    rows = [json.loads(line) for line in data.splitlines()]
    rows[0]["home_goals"] = 29
    base = {k: v for k, v in rows[0].items() if k != "normalized_row_sha256"}
    rows[0]["normalized_row_sha256"] = sha256(canonical_json(base)).hexdigest()
    tampered = b"\n".join(map(canonical_json, rows)) + b"\n"
    manifest["normalizedSha256"] = sha256(tampered).hexdigest()
    with pytest.raises(ArchiveError):
        validate_archive(manifest, tampered)
