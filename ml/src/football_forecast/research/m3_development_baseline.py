"""M3 synthetic-only H/D/A frequency baseline for five frozen RPL development folds.

No I/O, secrets, live rows, model persistence, independent holdout, or publication.
Synthetic fixture IDs are a test boundary, NOT cryptographic origin evidence.
Actual historical research must use a separately reviewed and provenance-checked
protected runner; this module never authorizes that work.
"""
from collections import Counter
from dataclasses import dataclass
from math import fsum

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.scoring import (
    brier_score,
    log_loss,
    ranked_probability_score,
)
from football_forecast.research.rpl_development_folds import (
    PLAN,
    VALIDATION_SEASONS,
    plan_expanding_development_folds,
)
from football_forecast.research.rpl_temporal_features import (
    CLASSIFICATION,
    DevelopmentMatch,
)

BASELINE_VERSION = "m3-synthetic-expanding-hda-dirichlet1-v1"
PRIOR_PER_OUTCOME = 1


@dataclass(frozen=True, slots=True)
class SyntheticBaselineFold:
    validation_season: str
    training_seasons: tuple[str, ...]
    training_matches: int
    scored_matches: int
    training_outcomes_hda: tuple[int, int, int]
    probabilities_hda: tuple[float, float, float]
    mean_log_loss: float
    mean_brier: float
    mean_rps: float
    baseline: str = BASELINE_VERSION
    classification: str = CLASSIFICATION
    synthetic_only: bool = True
    sealed_holdout_read: bool = False
    bookmaker_superiority_claimed: bool = False


@dataclass(frozen=True, slots=True)
class SyntheticBaselineStudy:
    plan: str
    folds: tuple[SyntheticBaselineFold, ...]
    scored_matches: int
    mean_log_loss: float
    mean_brier: float
    mean_rps: float
    baseline: str = BASELINE_VERSION
    classification: str = CLASSIFICATION
    synthetic_only: bool = True
    real_source_eligibility_proven: bool = False
    sealed_holdout_read: bool = False
    bookmaker_superiority_claimed: bool = False


def _outcome(row: DevelopmentMatch) -> int:
    if row.home_goals > row.away_goals:
        return 0
    if row.home_goals == row.away_goals:
        return 1
    return 2


def evaluate_synthetic_hda_baseline(
    fixtures: tuple[DevelopmentMatch, ...],
) -> SyntheticBaselineStudy:
    """Score a fixed smoothed training-year frequency baseline.

    A fixed Laplace/Dirichlet(1,1,1) prior gives each H/D/A category
    one pseudo-count. Only *previous* complete years fit each fold.
    No validation-year outcome influences that fold's probabilities.
    This intentionally has no real-data or external-system entrypoint.
    """
    folds = plan_expanding_development_folds(fixtures)
    if any(not row.source_match_id.startswith("synthetic_") for row in fixtures):
        raise DataError("M3 baseline: synthetic-only fixtures required")
    if len(folds) != len(VALIDATION_SEASONS):
        raise DataError("M3 baseline: unexpected fold count")
    # Freeze the order independently of caller input ordering. No identities or
    # labels are emitted: only aggregate synthetic test summaries.
    ordered = tuple(sorted(fixtures, key=lambda row: (
        row.season, row.kickoff_at, row.source_match_id
    )))
    reports = []
    for fold in folds:
        train = tuple(row for row in ordered if row.season in fold.training_seasons)
        validation = tuple(row for row in ordered if row.season == fold.validation_season)
        if len(train) != fold.training_matches or len(validation) != fold.validation_matches:
            raise DataError("M3 baseline: fold cohort mismatch")
        counts = Counter(_outcome(row) for row in train)
        total = len(train) + 3 * PRIOR_PER_OUTCOME
        probabilities = tuple(
            (counts[i] + PRIOR_PER_OUTCOME) / total for i in (0, 1, 2)
        )
        outcomes = tuple(_outcome(row) for row in validation)

        def mean(metric):
            return fsum(metric(probabilities, y) for y in outcomes) / len(outcomes)

        reports.append(SyntheticBaselineFold(
            validation_season=fold.validation_season,
            training_seasons=fold.training_seasons,
            training_matches=len(train),
            scored_matches=len(outcomes),
            training_outcomes_hda=tuple(counts[i] for i in (0, 1, 2)),
            probabilities_hda=probabilities,
            mean_log_loss=mean(log_loss),
            mean_brier=mean(brier_score),
            mean_rps=mean(ranked_probability_score),
        ))
    if tuple(f.validation_season for f in reports) != VALIDATION_SEASONS:
        raise DataError("M3 baseline: validation year mismatch")
    n = sum(f.scored_matches for f in reports)
    if n != 1200:
        raise DataError("M3 baseline: expected exactly 1200 synthetic validation fixtures")

    def weighted(name: str) -> float:
        return fsum(getattr(f, name) * f.scored_matches for f in reports) / n

    return SyntheticBaselineStudy(
        plan=PLAN,
        folds=tuple(reports),
        scored_matches=n,
        mean_log_loss=weighted("mean_log_loss"),
        mean_brier=weighted("mean_brier"),
        mean_rps=weighted("mean_rps"),
    )
