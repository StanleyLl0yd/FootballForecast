"""Synthetic-only private future score/abstention metric tests. No live labels."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from math import log

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.m4_private_prospective import (
    IndependentPlayedResult, ShadowVersion, summarize_private_shadow,
)


def _clock():
    return datetime(2026, 11, 22, 18, tzinfo=UTC)


def _forecast(index=0, *, kind="FORECAST", revision=1):
    kickoff = datetime(2026, 11, 20 if index == 0 else 21,
                       16 if index == 0 else 14,
                       30, tzinfo=UTC)
    return ShadowVersion(
        fixture_key=f"rpl-synthetic-future-{index}",
        revision=revision,
        kickoff_at=kickoff,
        observed_at=datetime(2026, 11, 11, 15, tzinfo=UTC),
        committed_at=datetime(2026, 11, 11, 15, 10, tzinfo=UTC),
        model_sha256="a"*64,input_sha256="b"*64,
        kind=kind,
        probs=(.5,.3,.2) if kind=="FORECAST" else None,
        prior=(1/3,1/3,1/3) if kind=="FORECAST" else None,
        abstention_reason=None if kind=="FORECAST" else "INPUT_UNVERIFIED",
    )


def _result(pred):
    return IndependentPlayedResult(
        fixture_key=pred.fixture_key,kickoff_at=pred.kickoff_at,
        reviewed_at=pred.kickoff_at + timedelta(hours=3),
        home_goals=2,away_goals=1,
        primary_sha256="c"*64,corroboration_sha256="d"*64,
    )


def test_no_outcomes_is_pending_and_cannot_invent_skill():
    a = _forecast()
    b = _forecast(1,kind="ABSTAIN")
    summary = summarize_private_shadow((a,b),(),_clock())
    assert summary.tracked_fixtures == 2
    assert summary.final_forecasts == 1
    assert summary.final_abstentions == 1
    assert summary.awaiting_results == 1
    assert summary.settled_scored == 0
    assert summary.coverage == .5
    assert summary.mean_log_loss is None
    assert summary.prior_log_loss is None
    assert summary.paired_gain_approx_95pct_halfwidth is None
    for flag in ("genuine_as_of_attested","independent_result_attested",
                 "model_approved","publication_authorized","holdout_2025_26_read"):
        assert getattr(summary,flag) is False


def test_only_valid_postgame_played_scores_are_provisional_aggregates():
    a,b = _forecast(),_forecast(1,kind="ABSTAIN")
    summary = summarize_private_shadow((a,b),(_result(a),),_clock())
    assert summary.settled_scored == 1
    assert summary.awaiting_results == 0
    assert summary.mean_log_loss == pytest.approx(-log(.5))
    assert summary.mean_brier == pytest.approx(.25+.09+.04)
    assert summary.mean_rps == pytest.approx(.25+.04)
    assert summary.prior_log_loss == pytest.approx(log(3))
    assert summary.prior_brier == pytest.approx(2/3)
    assert summary.paired_gain_approx_95pct_halfwidth is None
    assert "UNAPPROVED" not in summary.classification
    assert "PROVISIONAL" in summary.classification


def test_latest_append_only_revision_controls_outcome_and_abstention():
    first=_forecast()
    second=replace(first,revision=2,committed_at=first.committed_at
                   +timedelta(minutes=1),kind="ABSTAIN",probs=None,
                   prior=None,abstention_reason="SOURCE_REVISED")
    summary=summarize_private_shadow((second,first),(_result(first),),_clock())
    assert summary.final_abstentions == 1
    assert summary.settled_scored == 0
    assert summary.coverage == 0


@pytest.mark.parametrize("alter",[
    {"kickoff_at":datetime(2025,11,21,14,30,tzinfo=UTC)},
    {"observed_at":datetime(2026,11,10,15,tzinfo=UTC)},
    {"committed_at":datetime(2026,11,20,16,25,tzinfo=UTC)},
    {"fixture_key":31337},
    {"model_sha256":"z"*64},
    {"kind":"PUBLIC"},
    {"state":"PUBLISHED"},
    {"probs":(.6,.3,.3)},
    {"probs":(float("nan"),.1,.9)},
    {"revision":2},
])
def test_invalid_forged_or_nonprematch_versions_rejected(alter):
    with pytest.raises(DataError):
        summarize_private_shadow((replace(_forecast(),**alter),),(),_clock())


@pytest.mark.parametrize("alter",[
    {"status":"awarded"},
    {"result_kind":"technical"},
    {"reviewed_at":datetime(2026,11,20,16,25,tzinfo=UTC)},
    {"home_goals":-1},
    {"away_goals":21},
    {"corroboration_sha256":"c"*64},
    {"fixture_key":"rpl-unknown"},
])
def test_unreviewed_awarded_or_wrong_outcome_rejected(alter):
    pred=_forecast()
    result=replace(_result(pred),**alter)
    with pytest.raises(DataError):
        summarize_private_shadow((pred,),(result,),_clock())


def test_duplicate_stored_result_cannot_change_metrics():
    pred=_forecast()
    r=_result(pred)
    with pytest.raises(DataError):
        summarize_private_shadow((pred,),(r,r),_clock())


def test_missing_baseline_is_reported_missing_not_fabricated():
    p=replace(_forecast(),prior=None)
    s=summarize_private_shadow((p,),(_result(p),),_clock())
    assert s.settled_scored==1
    assert s.prior_log_loss is None and s.prior_brier is None
    assert s.mean_log_loss is not None


def test_no_io_result_table_source_or_holdout_coupling():
    from pathlib import Path

    p = Path(__file__).resolve().parents[1] / "src" / (
        "football_forecast/evaluation/m4_private_prospective.py"
    )
    source=p.read_text(encoding="utf-8")
    for bad in ("2025/26'","psycopg.connect","SELECT FROM","requests.get",
                "write_text","public.ff_forecasts"):
        assert bad not in source
