"""Public, inert contract for the tactical research registry (no model/data I/O)."""
import json
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[2] / "docs" / (
    "TACTICAL_HYPOTHESIS_REGISTRY_2026-11-10.json"
)

def test_registry_hypotheses_have_provenance_and_fail_closed_status():
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    assert data["research_status"] == "RESEARCH_ONLY_NOT_MODEL_ELIGIBLE"
    assert data["m3_boundaries"]["acceptance"] == "OPEN_2_OF_8_A3_PENDING"
    assert "2025/26" not in data["m3_boundaries"]["development_seasons"]
    assert "2026/27" not in data["m3_boundaries"]["validation_seasons"]
    assert len(data["hypotheses"]) == 13
    assert len({h["id"] for h in data["hypotheses"]}) == 13
    for h in data["hypotheses"]:
        assert h["hypothesis"] and h["source_reference"].startswith("https://")
        assert h["author_interpretation"] and h["confirmed_observation"]
        assert h["candidate"] and h["requires"] and h["method"]
        assert h["original_post_permalink"] is None
        assert h["post_permalink_verified"] is False
        assert h["testing_status"] == "UNTESTED_NO_ELIGIBLE_HISTORICAL_TACTICAL_ROWS"
    assert all(
        e["source_scope"] != "proof of tactical attribution"
        for e in data["independent_match_context"]
    )
