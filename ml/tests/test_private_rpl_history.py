"""Synthetic-only validation of private seven-season RPL source documents."""
import copy
import json
from hashlib import sha256

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.data.rpl_private_history import SEASONS, validate_history_document


def document():
    years = []
    for season in SEASONS:
        year = int(season[:4])
        rows = [
            {
                "awayGoals": away % 3, "awayTeamId": f"team_{away}",
                "homeGoals": home % 4, "homeTeamId": f"team_{home}",
                "kickoffAt": f"{year}-09-15T16:00:00Z",
                "sourceMatchId": f"synthetic_{home}_{away}",
            }
            for home in range(16) for away in range(16) if home != away
        ]
        digest = sha256(json.dumps(
            rows, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
        ).encode()).hexdigest()
        years.append({
            "fixtures": rows, "normalizedRowsSha256": digest, "season": season,
            "sourceResponsesSha256": "a" * 64,
        })
    return {
        "codeSha": "b" * 40, "kind": "M2_PRIVATE_RPL_HISTORY_SOURCE_ONLY",
        "observedAtUtc": "2026-11-03T15:30:00Z",
        "researchRole": "development_source_only", "runId": 1234,
        "schemaVersion": 1, "seasons": years, "source": "OpenFoot Starter",
    }


def check_refused(change):
    d = document()
    change(d)
    with pytest.raises(DataError, match="M2 RPL private history"):
        validate_history_document(d)


def test_complete_development_only_cohort():
    d, rows = validate_history_document(document())
    assert d["source"] == "OpenFoot Starter"
    assert len(rows) == 7
    assert sum(len(season) for season in rows) == 1680
    assert all(len({r["sourceMatchId"] for r in season}) == 240 for season in rows)


def test_sealed_holdout_and_extra_fields_rejected():
    check_refused(lambda d: d["seasons"][-1].update(season="2025/26"))
    check_refused(lambda d: d["seasons"].append(copy.deepcopy(d["seasons"][0])))
    check_refused(lambda d: d.update(providerRawFixtures=[]))
    check_refused(lambda d: d.update(researchRole="sealed_holdout"))


def test_score_identity_and_hash_tampering_rejected():
    check_refused(lambda d: d["seasons"][0]["fixtures"][0].update(homeGoals=100))
    check_refused(lambda d: d["seasons"][0]["fixtures"][0].update(homeGoals=None))
    check_refused(lambda d: d["seasons"][0].update(normalizedRowsSha256="0" * 64))
    check_refused(lambda d: d["seasons"][0]["fixtures"][0].update(
        homeTeamId=d["seasons"][0]["fixtures"][0]["awayTeamId"]
    ))
    check_refused(lambda d: d["seasons"][0]["fixtures"][0].update(
        sourceMatchId="synthetic_0_2"
    ))


def test_temporal_bounds_and_no_foreign_source():
    check_refused(lambda d: d["seasons"][0]["fixtures"][0].update(
        kickoffAt="2025-09-15T16:00:00Z"
    ))
    check_refused(lambda d: d["seasons"][1]["fixtures"][0].update(
        kickoffAt="2020-08-08T12:00:00Z"
    ))
    check_refused(lambda d: d.update(source="another-provider"))
    check_refused(lambda d: d.update(observedAtUtc="2026-11-03T18:00:00+03:00"))
