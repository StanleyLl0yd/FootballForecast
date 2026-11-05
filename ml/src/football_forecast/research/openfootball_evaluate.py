"""Pure, source-independent M2 scoring preparation for the OpenFootball calendar study.

No I/O, source lookup, training, holdout reads, database writes or publication.
An authenticated protected worker MUST separately verify a reviewed, immutable
pre-holdout study record, data-use rights, pinned source bytes and the one-use
authorization BEFORE obtaining any real 2025/26 labels or calling this module.
Constructing the dataclasses here is NOT such authorization.
"""
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from math import fsum
from re import fullmatch

from football_forecast.data.contracts import DataError, aware
from football_forecast.data.openfootball_training import PROTOCOL
from football_forecast.evaluation.scoring import (
    brier_score,
    log_loss,
    ranked_probability_score,
)
from football_forecast.models.team_strength import (
    InsufficientTrainingData,
    TeamStrengthModel,
)
from football_forecast.research.evaluate import NonStrictAggregateResult
from football_forecast.research.locking import _digest
from football_forecast.research.model_escrow import (
    _fingerprint_for_protocol,
    serialize_private_model,
)

_SHA = r"[a-f0-9]{64}"
_GIT = r"[a-f0-9]{40}"
_ALIAS = r"(?:S|U)_[A-F0-9]{20}"
_START = datetime(2025, 7, 1, tzinfo=UTC)
_END = datetime(2026, 7, 1, tzinfo=UTC)
_FROZEN_TRAIN_HDA = (103, 65, 72)


@dataclass(frozen=True, slots=True)
class CalendarStudyLock:
    """Aggregate witness proposed for a separately authenticated protected lock.

    Train and holdout fingerprints are intentionally DIFFERENT identities.
    The source/crosswalk/retrieval commitments must be set before any label read;
    this object alone does not prove that chronology or authorize evaluation.
    """
    train_code_sha: str
    train_source_sha256: str
    train_rows_sha256: str
    train_club_mapping_sha256: str
    fitted_model_sha256: str
    model_artifact_sha256: str
    holdout_source_sha256: str
    holdout_snapshot_identity_sha256: str
    holdout_crosswalk_sha256: str
    train_outcome_counts_hda: tuple[int, int, int]
    protocol: str = PROTOCOL
    research_classification: str = "NON_STRICT_RETROSPECTIVE"
    holdout_read: bool = False


@dataclass(frozen=True, slots=True)
class CalendarHoldoutFixture:
    match_id: str
    kickoff_at: datetime
    home_team_id: str
    away_team_id: str
    home_goals: int
    away_goals: int
    confirmed_kickoff: bool
    result_kind: str
    status: str


@dataclass(frozen=True, slots=True)
class CalendarHoldoutBatch:
    snapshot_id: str
    source_sha256: str
    crosswalk_sha256: str
    retrieved_at: datetime
    season: str
    role: str
    fixtures: tuple[CalendarHoldoutFixture, ...]


def _check_lock_and_model(lock: CalendarStudyLock, model: TeamStrengthModel) -> None:
    if (type(lock) is not CalendarStudyLock
            or lock.protocol != PROTOCOL
            or lock.research_classification != "NON_STRICT_RETROSPECTIVE"
            or lock.holdout_read is not False
            or type(lock.train_outcome_counts_hda) is not tuple
            or lock.train_outcome_counts_hda != _FROZEN_TRAIN_HDA
            or type(lock.train_code_sha) is not str
            or not fullmatch(_GIT, lock.train_code_sha)):
        raise DataError("M2 calendar evaluation: unverified fixed training study")
    for key in (
        "train_source_sha256", "train_rows_sha256",
        "train_club_mapping_sha256", "fitted_model_sha256",
        "model_artifact_sha256", "holdout_source_sha256",
        "holdout_snapshot_identity_sha256", "holdout_crosswalk_sha256",
    ):
        value = getattr(lock, key)
        if type(value) is not str or not fullmatch(_SHA, value):
            raise DataError("M2 calendar evaluation: invalid study fingerprint")
    if lock.holdout_source_sha256 == lock.train_source_sha256:
        raise DataError("M2 calendar evaluation: train/holdout source identities conflated")
    try:
        canonical = serialize_private_model(model, protocol=PROTOCOL)
        if (sha256(canonical).hexdigest() != lock.model_artifact_sha256
                or _fingerprint_for_protocol(model, PROTOCOL) != lock.fitted_model_sha256):
            raise DataError("M2 calendar evaluation: model differs from fixed escrow")
    except (TypeError, ValueError, AttributeError) as exc:
        raise DataError("M2 calendar evaluation: malformed fixed model") from exc


def score_fixed_calendar_holdout(
    lock: CalendarStudyLock,
    model: TeamStrengthModel,
    batch: CalendarHoldoutBatch,
) -> NonStrictAggregateResult:
    """Score one *already authorized* sealed cohort with a frozen 2024/25 model.

    The trusted executor must compare the full lock against a protected immutable
    owner-reviewed record, authenticate the holdout source/crosswalk as frozen
    before opening labels, and enforce single-use externally. This pure function
    checks identities and data shape but cannot establish that provenance alone.
    """
    _check_lock_and_model(lock, model)
    if (type(batch) is not CalendarHoldoutBatch
            or batch.season != "2025/2026"
            or batch.role != "sealed_holdout"
            or type(batch.source_sha256) is not str
            or batch.source_sha256 != lock.holdout_source_sha256
            or type(batch.crosswalk_sha256) is not str
            or batch.crosswalk_sha256 != lock.holdout_crosswalk_sha256
            or type(batch.snapshot_id) is not str
            or not batch.snapshot_id.strip()
            or len(batch.snapshot_id) > 100
            or type(batch.fixtures) is not tuple
            or len(batch.fixtures) != 240):
        raise DataError("M2 calendar evaluation: independent holdout identity refused")
    aware(batch.retrieved_at, "retrieved_at")
    if (batch.retrieved_at.utcoffset() is None
            or batch.retrieved_at.utcoffset().total_seconds() != 0
            or batch.retrieved_at < _END
            or _digest([batch.snapshot_id, batch.source_sha256,
                        batch.retrieved_at.isoformat()]) != lock.holdout_snapshot_identity_sha256):
        raise DataError("M2 calendar evaluation: holdout snapshot commitment differs")

    match_ids: set[str] = set()
    directed_pairs: set[tuple[str, str]] = set()
    appearances: Counter[str] = Counter()
    homes: Counter[str] = Counter()
    aways: Counter[str] = Counter()
    club_days: set[tuple[str, object]] = set()
    for row in batch.fixtures:
        if type(row) is not CalendarHoldoutFixture:
            raise DataError("M2 calendar evaluation: malformed heldout record")
        aware(row.kickoff_at, "kickoff_at")
        if (row.kickoff_at.utcoffset() is None
                or row.kickoff_at.utcoffset().total_seconds() != 0
                or row.status != "finished"
                or row.result_kind != "played"
                or row.confirmed_kickoff is not True
                or not _START <= row.kickoff_at < _END
                or row.kickoff_at >= batch.retrieved_at
                or type(row.match_id) is not str
                or not row.match_id.strip()
                or len(row.match_id) > 100
                or any(type(t) is not str or not fullmatch(_ALIAS, t)
                       for t in (row.home_team_id, row.away_team_id))
                or row.home_team_id == row.away_team_id
                or any(type(n) is not int or not 0 <= n <= 20
                       for n in (row.home_goals, row.away_goals))):
            raise DataError("M2 calendar evaluation: invalid played fixture")
        pair = (row.home_team_id, row.away_team_id)
        if row.match_id in match_ids or pair in directed_pairs:
            raise DataError("M2 calendar evaluation: duplicate match or direction")
        day = row.kickoff_at.date()
        for club in pair:
            if (club, day) in club_days:
                raise DataError("M2 calendar evaluation: club plays twice on one UTC day")
            club_days.add((club, day))
        match_ids.add(row.match_id)
        directed_pairs.add(pair)
        appearances.update(pair)
        homes[row.home_team_id] += 1
        aways[row.away_team_id] += 1
    if (len(appearances) != 16 or any(n != 30 for n in appearances.values())
            or any(homes[club] != 15 or aways[club] != 15 for club in appearances)):
        raise DataError("M2 calendar evaluation: incomplete 16-club double round robin")

    prior = tuple(v / 240 for v in lock.train_outcome_counts_hda)
    model_scores: list[tuple[float, float, float]] = []
    prior_scores: list[tuple[float, float, float]] = []
    unseen = 0
    for row in sorted(batch.fixtures, key=lambda fixture: (fixture.kickoff_at, fixture.match_id)):
        try:
            prediction = model.predict(row.home_team_id, row.away_team_id)
        except InsufficientTrainingData:
            unseen += 1
            continue
        probabilities = (prediction.home_win, prediction.draw, prediction.away_win)
        outcome = 0 if row.home_goals > row.away_goals else (
            1 if row.home_goals == row.away_goals else 2)
        model_scores.append((
            log_loss(probabilities, outcome),
            brier_score(probabilities, outcome),
            ranked_probability_score(probabilities, outcome),
        ))
        prior_scores.append((
            log_loss(prior, outcome),
            brier_score(prior, outcome),
            ranked_probability_score(prior, outcome),
        ))
    n = len(model_scores)
    def average(scores: list[tuple[float, float, float]], key: int) -> float | None:
        return fsum(item[key] for item in scores) / n if n else None
    return NonStrictAggregateResult(
        count=n, exclusions_unseen_club=unseen,
        model_log_loss=average(model_scores, 0),
        model_brier=average(model_scores, 1),
        model_rps=average(model_scores, 2),
        training_prior_log_loss=average(prior_scores, 0),
        training_prior_brier=average(prior_scores, 1),
        training_prior_rps=average(prior_scores, 2),
    )
