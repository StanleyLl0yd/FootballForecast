"""Offline fixed-lock 2025/26 evaluation; no I/O, fetching, training or publishing.

Only a trusted worker may read a sealed cohort AFTER anchoring a pre-holdout
lock. Synthetic tests do not constitute the first real holdout evaluation.
"""
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from math import fsum

from football_forecast.data.contracts import DataError, aware
from football_forecast.evaluation.scoring import (
    brier_score,
    log_loss,
    ranked_probability_score,
)
from football_forecast.models.team_strength import (
    InsufficientTrainingData,
    TeamStrengthModel,
)
from football_forecast.research.locking import (
    PROTOCOL,
    PreHoldoutLock,
    _digest,
    _model_fingerprint,
)

_START = datetime(2025, 7, 1, tzinfo=UTC)
_END = datetime(2026, 7, 1, tzinfo=UTC)


@dataclass(frozen=True, slots=True)
class ResearchHoldoutFixture:
    match_id: str
    kickoff_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int
    confirmed_kickoff: bool
    status: str = "finished"


@dataclass(frozen=True, slots=True)
class ResearchHoldoutBatch:
    snapshot_id: str
    source_sha256: str
    retrieved_at: datetime
    season: str
    role: str
    fixtures: tuple[ResearchHoldoutFixture, ...]


@dataclass(frozen=True, slots=True)
class NonStrictAggregateResult:
    count: int
    exclusions_unseen_club: int
    model_log_loss: float | None
    model_brier: float | None
    model_rps: float | None
    training_prior_log_loss: float | None
    training_prior_brier: float | None
    training_prior_rps: float | None

    def as_dict(self) -> dict[str, object]:
        return {
            "schemaVersion": 1,
            "kind": "M2_NON_STRICT_FIXED_MODEL_AGGREGATE",
            "eligibleMatches": self.count,
            "exclusions": {"unseenTrainingClub": self.exclusions_unseen_club},
            "model": {
                "logLoss": self.model_log_loss,
                "brierHDA": self.model_brier,
                "rps": self.model_rps,
            } if self.count else None,
            "trainOnlyFrequencyBaseline": {
                "logLoss": self.training_prior_log_loss,
                "brierHDA": self.training_prior_brier,
                "rps": self.training_prior_rps,
            } if self.count else None,
            "researchClassification": "NON_STRICT_RETROSPECTIVE",
            "uncertainty": "INCONCLUSIVE",
            "strictHistoricalAsOfVerified": False,
            "calibrationOrSuperiorityClaimed": False,
            "productionForecastsWritten": 0,
        }


def evaluate_fixed_locked_holdout(
    lock: PreHoldoutLock,
    model: TeamStrengthModel,
    batch: ResearchHoldoutBatch,
) -> NonStrictAggregateResult:
    """Pure scorer; never loads labels itself or changes any model parameter.

    The trusted caller MUST verify a previously protected/immutable lock and
    one-time approval BEFORE retrieving batch, not after this function runs.
    """
    if (not isinstance(lock, PreHoldoutLock) or lock.protocol != PROTOCOL
            or lock.holdout_read or lock.historical_prematch_verified
            or lock.training_matches != 240 or lock.training_clubs != 16
            or sum(lock.train_outcome_counts) != 240
            or any(type(v) is not int or v < 0 for v in lock.train_outcome_counts)
            or _model_fingerprint(model) != lock.fitted_model_sha256):
        raise DataError("M2 evaluation: unverified fixed training model lock")
    if (not isinstance(batch, ResearchHoldoutBatch)
            or batch.season != "2025/2026" or batch.role != "sealed_holdout"
            or batch.source_sha256 != lock.source_sha256
            or len(batch.fixtures) != 240):
        raise DataError("M2 evaluation: sealed holdout cohort identity mismatch")
    aware(batch.retrieved_at, "retrieved_at")
    if (batch.retrieved_at < _END
            or _digest([batch.snapshot_id, batch.source_sha256,
                        batch.retrieved_at.isoformat()]) != lock.snapshot_identity_sha256):
        raise DataError("M2 evaluation: holdout snapshot differs from fixed training snapshot")

    ids = set()
    pairs = set()
    counts: Counter[str] = Counter()
    for row in batch.fixtures:
        aware(row.kickoff_at, "kickoff_at")
        if (row.status != "finished" or row.confirmed_kickoff is not True
                or not _START <= row.kickoff_at < _END
                or row.kickoff_at >= batch.retrieved_at
                or any(not isinstance(v, str) or not v.strip() or len(v) > 100
                       for v in (row.match_id, row.home_team_id, row.away_team_id))
                or row.home_team_id == row.away_team_id
                or any(type(v) is not int or not 0 <= v <= 20
                       for v in (row.home_goals, row.away_goals))):
            raise DataError("M2 evaluation: invalid completed holdout match or timing")
        key = (row.home_team_id, row.away_team_id)
        if row.match_id in ids or key in pairs:
            raise DataError("M2 evaluation: duplicate holdout fixture or identity")
        ids.add(row.match_id)
        pairs.add(key)
        counts.update(key)
    if len(counts) != 16 or any(n != 30 for n in counts.values()):
        raise DataError("M2 evaluation: incomplete holdout club coverage")

    baseline = tuple(value / 240 for value in lock.train_outcome_counts)
    model_scores: list[tuple[float, float, float]] = []
    prior_scores: list[tuple[float, float, float]] = []
    unseen = 0
    for row in batch.fixtures:
        try:
            prediction = model.predict(row.home_team_id, row.away_team_id)
        except InsufficientTrainingData:
            unseen += 1
            continue
        probs = (prediction.home_win, prediction.draw, prediction.away_win)
        outcome = 0 if row.home_goals > row.away_goals else (
            1 if row.home_goals == row.away_goals else 2
        )
        model_scores.append((
            log_loss(probs, outcome),
            brier_score(probs, outcome),
            ranked_probability_score(probs, outcome),
        ))
        prior_scores.append((
            log_loss(baseline, outcome),
            brier_score(baseline, outcome),
            ranked_probability_score(baseline, outcome),
        ))

    n = len(model_scores)

    def avg(scores: list[tuple[float, float, float]], col: int) -> float | None:
        return fsum(item[col] for item in scores) / n if n else None

    return NonStrictAggregateResult(
        count=n,
        exclusions_unseen_club=unseen,
        model_log_loss=avg(model_scores, 0),
        model_brier=avg(model_scores, 1),
        model_rps=avg(model_scores, 2),
        training_prior_log_loss=avg(prior_scores, 0),
        training_prior_brier=avg(prior_scores, 1),
        training_prior_rps=avg(prior_scores, 2),
    )
