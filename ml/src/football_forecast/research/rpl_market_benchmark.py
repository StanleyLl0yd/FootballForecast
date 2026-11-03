"""Pure paired H/D/A odds benchmark for the development seasons only.

Historical odds capture timestamps must be independently authenticated by
a protected data pipeline. Caller-supplied booleans alone are not evidence.
No betting advice, fetch, model fitting, calibration, private data or holdout.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import fsum, isfinite

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.scoring import (
    brier_score,
    log_loss,
    ranked_probability_score,
)
from football_forecast.research.rpl_development_folds import VALIDATION_SEASONS

MAX_QUOTE_AGE = timedelta(hours=36)
MAX_OVERROUND = 1.30
BENCHMARK_VERSION = "rpl-hda-market-midnight-utc-v1"


@dataclass(frozen=True, slots=True)
class DevelopmentPrediction:
    season: str
    match_id: str
    kickoff_at: datetime
    cutoff_at: datetime
    probabilities: tuple[float, float, float]
    actual_outcome: int


@dataclass(frozen=True, slots=True)
class HistoricalMarketQuote:
    season: str
    match_id: str
    cutoff_at: datetime
    observed_at: datetime
    decimal_odds: tuple[float, float, float]
    historically_captured_before_cutoff: bool


@dataclass(frozen=True, slots=True)
class MarketComparison:
    benchmark: str
    forecast_count: int
    matched_count: int
    unavailable_market_quotes: int
    model_log_loss: float | None
    market_log_loss: float | None
    mean_log_loss_difference: float | None
    model_brier: float | None
    market_brier: float | None
    model_rps: float | None
    market_rps: float | None
    classification: str = "NON_STRICT_RETROSPECTIVE"
    uncertainty: str = "INCONCLUSIVE_DEPENDENT_MATCHES"
    bookmaker_superiority_claimed: bool = False
    sealed_holdout_read: bool = False


def _utc_time(value: datetime) -> None:
    if (not isinstance(value, datetime) or value.tzinfo is None
            or value.utcoffset() != timedelta(0)):
        raise DataError("RPL odds: explicit UTC timestamp required")


def _identity(season: str, match_id: str) -> tuple[str, str]:
    if (season not in VALIDATION_SEASONS or
            not isinstance(match_id, str) or
            not 0 < len(match_id) <= 160 or not match_id.strip()):
        raise DataError("RPL odds: invalid development-only identity")
    return season, match_id


def _cutoff(kickoff: datetime, cutoff: datetime) -> None:
    _utc_time(kickoff)
    _utc_time(cutoff)
    expected = datetime(kickoff.year, kickoff.month, kickoff.day, tzinfo=UTC)
    if cutoff != expected or not cutoff < kickoff:
        raise DataError("RPL odds: cutoff must be UTC midnight before kickoff")


def remove_bookmaker_overround(
    decimal_odds: tuple[float, float, float],
) -> tuple[float, float, float]:
    """Proportional no-vig normalization from a full same-bookmaker 1X2 triple."""
    if (type(decimal_odds) is not tuple or len(decimal_odds) != 3
            or any(type(o) not in (float, int) or not isfinite(o)
                   or not 1.01 <= o <= 1000 for o in decimal_odds)):
        raise DataError("RPL odds: invalid or incomplete H/D/A decimal prices")
    implied = tuple(1.0 / x for x in decimal_odds)
    overround = fsum(implied)
    if not 1.0 <= overround <= MAX_OVERROUND:
        raise DataError("RPL odds: missing or implausible positive bookmaker margin")
    return tuple(x / overround for x in implied)


def compare_development_market(
    forecasts: tuple[DevelopmentPrediction, ...],
    quotes: tuple[HistoricalMarketQuote, ...],
) -> MarketComparison:
    """Matched-cohort paired metrics; missing odds excluded and counted.

    Enforces midnight UTC model cutoff and a market quote captured no later
    than that cutoff. Never aligns an earlier model with closing odds.
    """
    if type(forecasts) is not tuple or type(quotes) is not tuple or len(forecasts) > 1200:
        raise DataError("RPL odds: invalid or oversized development comparison")
    actual = {}
    for f in forecasts:
        if not isinstance(f, DevelopmentPrediction):
            raise DataError("RPL odds: untrusted forecast record")
        key = _identity(f.season, f.match_id)
        if key in actual:
            raise DataError("RPL odds: duplicated model fixture")
        _cutoff(f.kickoff_at, f.cutoff_at)
        if type(f.actual_outcome) is not int or f.actual_outcome not in (0, 1, 2):
            raise DataError("RPL odds: invalid H/D/A label")
        # Validate the same probability contract and class order as M2.
        log_loss(f.probabilities, f.actual_outcome)
        actual[key] = f
    quote_map = {}
    for q in quotes:
        if not isinstance(q, HistoricalMarketQuote):
            raise DataError("RPL odds: untrusted market quote")
        key = _identity(q.season, q.match_id)
        if key in quote_map or key not in actual:
            raise DataError("RPL odds: duplicate or unmatched bookmaker fixture")
        f = actual[key]
        _utc_time(q.observed_at)
        _utc_time(q.cutoff_at)
        if (q.historically_captured_before_cutoff is not True
                or q.cutoff_at != f.cutoff_at
                or not q.observed_at <= f.cutoff_at
                or f.cutoff_at - q.observed_at > MAX_QUOTE_AGE):
            raise DataError("RPL odds: late, stale or unverified market observation")
        quote_map[key] = remove_bookmaker_overround(q.decimal_odds)
    model_scores, market_scores = [], []
    for key, f in sorted(actual.items()):
        if key not in quote_map:
            continue
        b = quote_map[key]
        model_scores.append((
            log_loss(f.probabilities, f.actual_outcome),
            brier_score(f.probabilities, f.actual_outcome),
            ranked_probability_score(f.probabilities, f.actual_outcome),
        ))
        market_scores.append((
            log_loss(b, f.actual_outcome),
            brier_score(b, f.actual_outcome),
            ranked_probability_score(b, f.actual_outcome),
        ))
    n = len(model_scores)

    def mean(scores: list[tuple[float, float, float]], i: int) -> float | None:
        return fsum(score[i] for score in scores) / n if n else None

    model_log = mean(model_scores, 0)
    market_log = mean(market_scores, 0)
    return MarketComparison(
        benchmark=BENCHMARK_VERSION,
        forecast_count=len(actual),
        matched_count=n,
        unavailable_market_quotes=len(actual) - n,
        model_log_loss=model_log,
        market_log_loss=market_log,
        mean_log_loss_difference=model_log - market_log if n else None,
        model_brier=mean(model_scores, 1),
        market_brier=mean(market_scores, 1),
        model_rps=mean(model_scores, 2),
        market_rps=mean(market_scores, 2),
    )
