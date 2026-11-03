"""Owner-triggered source-pinned calendar-only fit; never reads Footbolno or holdout."""
import json
import os
import sys
from collections import Counter
from pathlib import Path
from re import fullmatch

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import (
    PROTOCOL,
    REFERENCE_BLOB,
    REFERENCE_COMMIT,
    read_openfootball_calendar_training,
)
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research.locking import _digest


def produce_openfootball_train_candidate(document: object, *, code_sha: str) -> dict:
    if not isinstance(code_sha, str) or not fullmatch(r"[a-f0-9]{40}", code_sha):
        raise DataError("M2 OpenFootball: invalid executing commit")
    fixtures, source_sha = read_openfootball_calendar_training(document)
    model = fit_independent_poisson(fixtures)
    if model.training_matches != 240 or len(model.teams) != 16:
        raise DataError("M2 OpenFootball: incomplete model")
    outcomes = Counter(
        0 if f.home_goals > f.away_goals else
        1 if f.home_goals == f.away_goals else 2 for f in fixtures
    )
    rows_digest = _digest([
        [f.match_id, f.source_calendar_date.isoformat(), f.round,
         f.home_team_id, f.away_team_id, f.home_goals, f.away_goals]
        for f in fixtures
    ])
    model_digest = _digest({
        "protocol": PROTOCOL, "teams": model.teams,
        "attack": [x.hex() for x in model.attack],
        "defence": [x.hex() for x in model.defence],
        "appearances": model.appearances,
        "intercept": model.intercept.hex(),
        "homeAdvantage": model.home_advantage.hex(),
        "trainingMatches": model.training_matches,
    })
    return {
        "schemaVersion": 1,
        "kind": "M2_OPENFOOTBALL_EPHEMERAL_TRAIN_CANDIDATE",
        "protocol": PROTOCOL,
        "researchClassification": "TRAIN_ONLY_UNAPPROVED",
        "source": "OpenFootball",
        "sourceLicense": "CC0-1.0",
        "sourceCommit": REFERENCE_COMMIT,
        "sourceGitBlobSha1": REFERENCE_BLOB,
        "sourceBytesSha256": source_sha,
        "codeSha": code_sha,
        "trainRowsSha256": rows_digest,
        "clubMappingSha256": _digest(list(model.teams)),
        "fittedModelSha256": model_digest,
        "trainingMatches": model.training_matches,
        "trainingClubs": len(model.teams),
        "trainOutcomeCountsHDA": [outcomes[i] for i in range(3)],
        "kickoffInstantsVerified": 0,
        "historicalPrematchVerified": False,
        "holdoutRead": False,
        "modelApproved": False,
        "privateModelPersisted": False,
        "productionForecastsWritten": 0,
        "footbolnoRequired": False,
    }


def main() -> None:
    try:
        if len(sys.argv) != 2:
            raise DataError("M2 OpenFootball: expected private bounded input file")
        path = Path(sys.argv[1])
        if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= 100_000:
            raise DataError("M2 OpenFootball: invalid bounded private input")
        document = json.loads(path.read_text(encoding="utf-8"))
        result = produce_openfootball_train_candidate(
            document, code_sha=os.environ.get("GITHUB_SHA", ""),
        )
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    except (DataError, ValueError, UnicodeError, OSError):
        print("FAIL: M2 OpenFootball train-only input refused; no rows emitted", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
