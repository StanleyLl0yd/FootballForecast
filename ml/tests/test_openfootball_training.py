from datetime import UTC, date, datetime, timedelta
from hashlib import sha256

import pytest

from football_forecast.data.contracts import DataError, FinishedMatch
from football_forecast.data.openfootball_training import (
    PROTOCOL,
    REFERENCE_BLOB,
    REFERENCE_COMMIT,
    read_openfootball_calendar_training,
)
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.openfootball_train import produce_openfootball_train_candidate


def fixture_doc():
    clubs = ["S_" + format(i, "020X") for i in range(16)]
    rotated = list(range(1, 16))
    rounds = []
    for _ in range(15):
        teams = [0, *rotated]
        rounds.append([(teams[i], teams[15 - i]) for i in range(8)])
        rotated.insert(0, rotated.pop())
    rounds += [[(a, h) for h, a in round_] for round_ in rounds]
    rows = []
    for round_no, games in enumerate(rounds, 1):
        day = (date(2024, 7, 20) + timedelta(days=(round_no - 1) * 10)).isoformat()
        for h, a in games:
            mid = "OF_" + sha256(f"synthetic:{h}:{a}".encode()).hexdigest()[:24].upper()
            rows.append({
                "matchId": mid, "calendarDateUtc": day, "round": round_no,
                "homeTeamId": clubs[h], "awayTeamId": clubs[a],
                "homeGoals": 2 if h < 8 else 1,
                "awayGoals": 1 if a < 8 else 0, "resultType": "played",
            })
    rows.sort(key=lambda r: (r["calendarDateUtc"], r["matchId"]))
    return {
        "schemaVersion": 1, "kind": "M2_OPENFOOTBALL_CALENDAR_TRAIN_INPUT",
        "protocol": PROTOCOL, "season": "2024/2025", "role": "train_baseline",
        "sourceLicense": "CC0-1.0", "sourceCommit": REFERENCE_COMMIT,
        "sourceGitBlobSha1": REFERENCE_BLOB, "sourceBytesSha256": "a" * 64,
        "historicalPrematchVerified": False, "fixtures": rows,
    }


def test_calendar_train_only_candidate_determinism_without_fake_kickoffs():
    doc = fixture_doc()
    a = produce_openfootball_train_candidate(doc, code_sha="b" * 40)
    b = produce_openfootball_train_candidate(doc, code_sha="b" * 40)
    assert a == b
    assert a["trainingMatches"] == 240 and a["trainingClubs"] == 16
    assert sum(a["trainOutcomeCountsHDA"]) == 240
    assert a["protocol"] == PROTOCOL
    assert a["holdoutRead"] is False and a["modelApproved"] is False
    assert a["privateModelPersisted"] is False and a["footbolnoRequired"] is False
    assert a["kickoffInstantsVerified"] == 0
    assert "S_" not in str(a) and "OF_" not in str(a)
    assert len(a["fittedModelSha256"]) == 64
    fixtures, _ = read_openfootball_calendar_training(doc)
    assert all(not hasattr(f, "kickoff_at") for f in fixtures)
    with pytest.raises(DataError, match="mix calendar"):
        fit_independent_poisson([fixtures[0], fixture_from_timestamp()])


def fixture_from_timestamp():
    now = datetime(2024, 7, 20, tzinfo=UTC)
    return FinishedMatch("synthetic-timestamp", now, now + timedelta(hours=2),
                         "S_" + "A" * 20, "S_" + "B" * 20, 1, 0)


@pytest.mark.parametrize("mutation", [
    lambda x: x.update(season="2025/2026"),
    lambda x: x.update(role="sealed_holdout"),
    lambda x: x.update(sourceGitBlobSha1="f" * 40),
    lambda x: x.update(sourceBytesSha256="bad"),
    lambda x: x.update(historicalPrematchVerified=True),
    lambda x: x.update(extra="untrusted"),
    lambda x: x["fixtures"].pop(),
    lambda x: x["fixtures"][0].update(kickoffAtUtc="2024-07-20T00:00:00Z"),
    lambda x: x["fixtures"][0].update(resultType="awarded"),
    lambda x: x["fixtures"][0].update(homeGoals=21),
    lambda x: x["fixtures"][0].update(homeTeamId=x["fixtures"][0]["awayTeamId"]),
    lambda x: x["fixtures"][0].update(calendarDateUtc="2026-01-01"),
    lambda x: x["fixtures"][0].update(round=31),
    lambda x: x["fixtures"][0].update(matchId=x["fixtures"][1]["matchId"]),
    lambda x: x["fixtures"].reverse(),
])
def test_invalid_scope_and_substitution_fails_closed(mutation):
    doc = fixture_doc()
    mutation(doc)
    with pytest.raises(DataError, match="M2 OpenFootball"):
        read_openfootball_calendar_training(doc)
