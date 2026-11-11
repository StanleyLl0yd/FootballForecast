"""M4-A6: provisional PRIVATE prospective shadow metrics; never public scores.

This pure reducer has NO DB/network access and does not itself attest
real first-observation or independent played labels. Only separately reviewed
A5 capture records and independent post-match A6 settlements may call it.
No 2025/26 input, bookmaker claims, auto model selection or forecast publication.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from math import fsum, isfinite, sqrt

from football_forecast.data.contracts import DataError
from football_forecast.evaluation.scoring import (
    brier_score, log_loss, ranked_probability_score,
)

M4_START = datetime(2026, 11, 11, 11, 4, 56, tzinfo=UTC)
MIN_LEAD_SECONDS = 900
SHA_CHARS = frozenset("0123456789abcdef")


@dataclass(frozen=True, slots=True)
class ShadowVersion:
    fixture_key: str
    revision: int
    kickoff_at: datetime
    observed_at: datetime
    committed_at: datetime
    model_sha256: str
    input_sha256: str
    kind: str
    probs: tuple[float, float, float] | None
    prior: tuple[float, float, float] | None
    abstention_reason: str | None
    state: str = "PRIVATE_SHADOW_UNAPPROVED"


@dataclass(frozen=True, slots=True)
class IndependentPlayedResult:
    fixture_key: str
    kickoff_at: datetime
    reviewed_at: datetime
    home_goals: int
    away_goals: int
    primary_sha256: str
    corroboration_sha256: str
    status: str = "finished"
    result_kind: str = "played"


@dataclass(frozen=True, slots=True)
class ShadowScoreSummary:
    classification: str
    tracked_fixtures: int
    final_forecasts: int
    final_abstentions: int
    settled_scored: int
    awaiting_results: int
    coverage: float
    mean_log_loss: float | None
    mean_brier: float | None
    mean_rps: float | None
    prior_log_loss: float | None
    prior_brier: float | None
    prior_rps: float | None
    paired_gain_approx_95pct_halfwidth: float | None
    genuine_as_of_attested: bool = False
    independent_result_attested: bool = False
    model_approved: bool = False
    publication_authorized: bool = False
    holdout_2025_26_read: bool = False


def _deny(reason: str):
    raise DataError("M4 private prospective scoring: " + reason)


def _sha(value: str) -> bool:
    return type(value) is str and len(value) == 64 and set(value) <= SHA_CHARS


def _utc(value: datetime) -> bool:
    return (isinstance(value, datetime) and value.tzinfo is not None
            and value.utcoffset() is not None
            and value.utcoffset().total_seconds() == 0)


def _probs(values: object) -> bool:
    return (type(values) is tuple and len(values) == 3
            and all(type(p) in (float, int) and isfinite(p)
                    and 0 <= p <= 1 for p in values)
            and abs(fsum(values)-1) <= 1e-9)


def summarize_private_shadow(
    versions: tuple[ShadowVersion, ...],
    played: tuple[IndependentPlayedResult, ...],
    inspected_at: datetime,
) -> ShadowScoreSummary:
    """Return only safe aggregates from validated synthetic/owner-only metadata."""
    if (type(versions) is not tuple or not 1 <= len(versions) <= 1500
            or type(played) is not tuple or len(played) > 240
            or not _utc(inspected_at)):
        _deny("invalid bounded cohort or clock")
    grouped: dict[str, list[ShadowVersion]] = defaultdict(list)
    for row in versions:
        if not isinstance(row, ShadowVersion):
            _deny("untrusted forecast row")
        if (not row.fixture_key.startswith("rpl-") or
                len(row.fixture_key) > 100 or not _sha(row.model_sha256) or
                not _sha(row.input_sha256) or row.state !=
                "PRIVATE_SHADOW_UNAPPROVED" or
                not all(_utc(t) for t in (
                    row.kickoff_at,row.observed_at,row.committed_at)) or
                not M4_START < row.observed_at <= row.committed_at <= inspected_at
                or not datetime(2026,7,1,tzinfo=UTC) <= row.kickoff_at <
                datetime(2027,7,1,tzinfo=UTC) or
                (row.kickoff_at-row.committed_at).total_seconds() <
                MIN_LEAD_SECONDS or type(row.revision) is not int or
                not 1 <= row.revision <= 100):
            _deny("nonprospective or untrusted forecast metadata")
        if row.kind == "FORECAST":
            if (row.abstention_reason is not None or not _probs(row.probs)
                    or (row.prior is not None and not _probs(row.prior))):
                _deny("malformed forecast probabilities")
        elif row.kind == "ABSTAIN":
            if (row.probs is not None or row.prior is not None
                    or type(row.abstention_reason) is not str
                    or not row.abstention_reason.isupper()
                    or len(row.abstention_reason) > 80):
                _deny("invalid abstention")
        else:
            _deny("unsupported forecast kind")
        grouped[row.fixture_key].append(row)
    if len(grouped) > 240:
        _deny("unexpected fixture count")
    finals = {}
    for fixture, records in grouped.items():
        revisions = sorted(records, key=lambda r: r.revision)
        first = revisions[0]
        if (revisions[0].revision != 1 or
                any(r.revision != i+1 for i,r in enumerate(revisions))
                or any(r.kickoff_at != first.kickoff_at or
                       r.model_sha256 != first.model_sha256
                       for r in revisions)
                or any(a.committed_at > b.committed_at
                       for a,b in zip(revisions,revisions[1:]))):
            _deny("incomplete or inconsistent append-only revisions")
        finals[fixture] = revisions[-1]

    results = {}
    for item in played:
        if (not isinstance(item, IndependentPlayedResult)
                or item.fixture_key not in finals
                or item.fixture_key in results
                or item.status != "finished" or item.result_kind != "played"
                or not all(_utc(t) for t in (item.kickoff_at,item.reviewed_at))
                or item.kickoff_at != finals[item.fixture_key].kickoff_at
                or not item.reviewed_at > item.kickoff_at
                or item.reviewed_at > inspected_at
                or type(item.home_goals) is not int or type(item.away_goals) is not int
                or not 0 <= item.home_goals <= 20 or
                not 0 <= item.away_goals <= 20
                or not _sha(item.primary_sha256)
                or not _sha(item.corroboration_sha256)
                or item.primary_sha256 == item.corroboration_sha256):
            _deny("result is not independently reviewed played score metadata")
        results[item.fixture_key] = item
    scored = []
    baseline = []
    pending = 0
    forecasts = abstentions = 0
    for fixture, last in finals.items():
        if last.kind == "ABSTAIN":
            abstentions += 1
            continue
        forecasts += 1
        result = results.get(fixture)
        if result is None:
            pending += 1
            continue
        outcome = (0 if result.home_goals > result.away_goals else
                   1 if result.home_goals == result.away_goals else 2)
        assert last.probs is not None
        scored.append((log_loss(last.probs,outcome),
                       brier_score(last.probs,outcome),
                       ranked_probability_score(last.probs,outcome)))
        baseline.append(None if last.prior is None else (
            log_loss(last.prior,outcome),
            brier_score(last.prior,outcome),
            ranked_probability_score(last.prior,outcome),
        ))
    def mean(index: int, rows) -> float:
        return fsum(r[index] for r in rows)/len(rows)
    score_n = len(scored)
    baseline_valid = score_n > 0 and all(x is not None for x in baseline)
    baseline_scores = [x for x in baseline if x is not None]
    paired_halfwidth = None
    if baseline_valid and score_n >= 30:
        differences = [prior[0]-model[0] for prior,model in
                       zip(baseline_scores,scored)]
        avg = fsum(differences)/score_n
        variance = fsum((x-avg)**2 for x in differences)/(score_n-1)
        paired_halfwidth = 1.96*sqrt(variance/score_n)
    return ShadowScoreSummary(
        classification="PRIVATE_PROVISIONAL_NEEDS_INDEPENDENT_A5_A6_ATTESTATION",
        tracked_fixtures=len(finals),
        final_forecasts=forecasts,final_abstentions=abstentions,
        settled_scored=score_n,awaiting_results=pending,
        coverage=forecasts/len(finals),
        mean_log_loss=mean(0,scored) if scored else None,
        mean_brier=mean(1,scored) if scored else None,
        mean_rps=mean(2,scored) if scored else None,
        prior_log_loss=mean(0,baseline_scores) if baseline_valid else None,
        prior_brier=mean(1,baseline_scores) if baseline_valid else None,
        prior_rps=mean(2,baseline_scores) if baseline_valid else None,
        paired_gain_approx_95pct_halfwidth=paired_halfwidth,
    )
