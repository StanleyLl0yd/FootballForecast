"""Pure synthetic-only paired RPL benchmark and timestamp guards."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from math import log

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.rpl_market_benchmark import (
    BENCHMARK_VERSION,
    DevelopmentPrediction,
    HistoricalMarketQuote,
    compare_development_market,
    remove_bookmaker_overround,
)

KICKOFF = datetime(2023, 9, 15, 18, tzinfo=UTC)
CUTOFF = datetime(2023, 9, 15, tzinfo=UTC)


def forecast(mid="synthetic_1", *, outcome=0, season="2023/24"):
    return DevelopmentPrediction(season, mid, KICKOFF, CUTOFF, (0.5, 0.3, 0.2), outcome)


def quote(mid="synthetic_1"):
    return HistoricalMarketQuote(
        "2023/24", mid, CUTOFF, CUTOFF - timedelta(hours=5),
        (2.0, 3.0, 4.0), True,
    )


def test_proportional_margin_removal_has_correct_hda_order():
    result = remove_bookmaker_overround((2.0, 3.0, 4.0))
    assert result == pytest.approx((6 / 13, 4 / 13, 3 / 13))
    assert sum(result) == pytest.approx(1.0)


def test_paired_logloss_brier_rps_and_missing_quote_denominator():
    result = compare_development_market((forecast(), forecast("synthetic_2", outcome=2)),
                                        (quote(),))
    assert result.benchmark == BENCHMARK_VERSION
    assert result.forecast_count == 2
    assert result.matched_count == 1
    assert result.unavailable_market_quotes == 1
    assert result.model_log_loss == pytest.approx(log(2))
    assert result.market_log_loss == pytest.approx(-log(6 / 13))
    assert result.mean_log_loss_difference == pytest.approx(log(2) + log(6 / 13))
    assert result.bookmaker_superiority_claimed is False
    assert result.sealed_holdout_read is False
    assert result.uncertainty == "INCONCLUSIVE_DEPENDENT_MATCHES"


def test_empty_market_coverage_has_no_comparison_or_win_claim():
    result = compare_development_market((forecast(),), ())
    assert result.matched_count == 0
    assert result.unavailable_market_quotes == 1
    assert result.market_log_loss is None
    assert result.model_log_loss is None
    assert result.mean_log_loss_difference is None
    assert result.bookmaker_superiority_claimed is False


@pytest.mark.parametrize("odds", [
    (1.0, 3.0, 3.0), (1.5, 1.5, 1.5), (10.0, 10.0, 10.0),
    (float("nan"), 3.0, 4.0), (float("inf"), 3.0, 4.0),
    (True, 3.0, 4.0), (2.0, 3.0), (2.0, None, 4.0),
])
def test_bad_margin_and_prices_refused(odds):
    with pytest.raises(DataError):
        remove_bookmaker_overround(odds)


def test_sealed_season_duplicate_and_unpaired_quotes_refused():
    with pytest.raises(DataError):
        compare_development_market((forecast(season="2025/26"),), ())
    with pytest.raises(DataError):
        compare_development_market((forecast(), forecast()), (quote(),))
    with pytest.raises(DataError):
        compare_development_market((forecast(),), (quote(), quote()))
    with pytest.raises(DataError):
        compare_development_market((forecast(),), (quote("different"),))


def test_market_after_cutoff_or_unverified_capture_refused():
    base = quote()
    wrong = (
        replace(base, observed_at=CUTOFF + timedelta(minutes=1)),
        replace(base, observed_at=KICKOFF - timedelta(minutes=1)),
        replace(base, observed_at=CUTOFF - timedelta(hours=37)),
        replace(base, historically_captured_before_cutoff=False),
        replace(base, cutoff_at=CUTOFF + timedelta(hours=1)),
        replace(base, observed_at=CUTOFF.replace(tzinfo=None)),
    )
    for item in wrong:
        with pytest.raises(DataError):
            compare_development_market((forecast(),), (item,))


def test_forecast_cutoff_not_midnight_utc_or_after_kickoff_refused():
    f = forecast()
    for modified in (
        replace(f, cutoff_at=CUTOFF + timedelta(minutes=1)),
        replace(f, kickoff_at=CUTOFF - timedelta(minutes=1)),
        replace(f, cutoff_at=CUTOFF.replace(tzinfo=None)),
        replace(f, actual_outcome=True),
        replace(f, probabilities=(0.6, 0.6, -0.2)),
    ):
        with pytest.raises((DataError, ValueError)):
            compare_development_market((modified,), ())


@pytest.mark.parametrize("wrong_kickoff", [
    datetime(2023, 6, 30, 18, tzinfo=UTC),
    datetime(2024, 7, 1, 18, tzinfo=UTC),
    datetime(2025, 9, 15, 18, tzinfo=UTC),
])
def test_market_comparator_rejects_season_relabelled_target(wrong_kickoff):
    # A matching midnight cutoff is not sufficient if the claimed year is false.
    f = replace(
        forecast(), kickoff_at=wrong_kickoff,
        cutoff_at=datetime(wrong_kickoff.year, wrong_kickoff.month,
                           wrong_kickoff.day, tzinfo=UTC),
    )
    with pytest.raises(DataError, match="kickoff outside declared development season"):
        compare_development_market((f,), ())
