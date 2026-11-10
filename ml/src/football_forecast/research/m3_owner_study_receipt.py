"""Validate privacy-preserving M3 real-development fold summaries.

This module neither fetches data nor authorizes model release. Data under audit
must already have been reduced to five aggregate-only SELECT results in the
protected process. The 2025/26 holdout is forbidden by construction.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from json import dumps
from re import fullmatch

from football_forecast.data.contracts import DataError

YEARS = ("2020/21", "2021/22", "2022/23", "2023/24", "2024/25")
TRAIN = (476, 714, 954, 1193, 1433)
SCORED = (238, 240, 239, 240, 240)
COLUMNS = (
    "validation_season", "train_n", "scored_n", "abstained_n", "unseen_n",
    "baseline_log_loss", "poisson_log_loss", "paired_log_loss_gain",
    "paired_gain_approx_95pct_halfwidth", "baseline_brier", "poisson_brier",
    "baseline_rps", "poisson_rps",
)
METRICS = COLUMNS[5:]


@dataclass(frozen=True, slots=True)
class StudyReceipt:
    schemaVersion: int
    kind: str
    revisionSha: str
    querySha256: str
    aggregateResultsSha256: str
    validatedFolds: int
    candidateScoredMatches: int
    withheldValidationCandidates: int
    poissonBetterLogLossFolds: int
    poissonBetterBrierFolds: int
    poissonBetterRpsFolds: int
    classification: str = "NON_STRICT_RETROSPECTIVE_PROVISIONAL"
    holdout2025_26Read: bool = False
    privateRowsExported: bool = False
    modelPersisted: bool = False
    publicForecastsWritten: bool = False
    acceptanceGranted: bool = False


def _invalid(reason: str) -> None:
    raise DataError("M3 owner study receipt: " + reason)


def _metric(value: object) -> Decimal:
    if type(value) not in (str, Decimal):
        _invalid("malformed numeric metric")
    try:
        decimal = Decimal(value)
    except InvalidOperation:
        _invalid("invalid metric encoding")
    if not decimal.is_finite() or decimal < 0 or decimal > 5:
        _invalid("metric outside safe range")
    return decimal


def audit_owner_study_aggregates(
    rows: list[dict], *, code_sha: str, sql_text: str,
) -> StudyReceipt:
    """Accept only five bounded aggregate rows and return fixed-schema receipt."""
    if type(code_sha) is not str or fullmatch(r"[a-f0-9]{40}", code_sha) is None:
        _invalid("untrusted protected SHA")
    if type(sql_text) is not str or not 2500 <= len(sql_text) <= 12000:
        _invalid("missing bounded SQL")
    if type(rows) is not list or len(rows) != 5:
        _invalid("five protected development folds required")
    serialized: list[dict[str, str | int]] = []
    ll_better = brier_better = rps_better = 0
    for i, row in enumerate(rows):
        if type(row) is not dict or tuple(row) != COLUMNS:
            _invalid("unknown source columns or order")
        if row["validation_season"] != YEARS[i]:
            _invalid("invalid development chronology")
        for name, value in (("train_n", TRAIN[i]), ("scored_n", SCORED[i]),
                            ("abstained_n", 240 - SCORED[i])):
            if type(row[name]) is not int or row[name] != value:
                _invalid("unexpected fold denominator")
        if type(row["unseen_n"]) is not int or not 0 <= row["unseen_n"] <= SCORED[i]:
            _invalid("invalid unseen candidate count")
        values: dict[str, Decimal] = {}
        for name in METRICS:
            if name == "paired_log_loss_gain":
                v = row[name]
                if type(v) not in (str, Decimal):
                    _invalid("invalid signed difference")
                try:
                    value = Decimal(v)
                except InvalidOperation:
                    _invalid("invalid signed difference")
                if not value.is_finite() or abs(value) > 5:
                    _invalid("invalid signed difference")
                values[name] = value
            else:
                values[name] = _metric(row[name])
        if abs(values["baseline_log_loss"] - values["poisson_log_loss"]
               - values["paired_log_loss_gain"]) > Decimal("0.000003"):
            _invalid("inconsistent paired gain")
        ll_better += int(values["poisson_log_loss"] < values["baseline_log_loss"])
        brier_better += int(values["poisson_brier"] < values["baseline_brier"])
        rps_better += int(values["poisson_rps"] < values["baseline_rps"])
        serialized.append({
            name: str(row[name]) if name in METRICS else row[name]
            for name in COLUMNS
        })
    canonical = dumps(serialized, ensure_ascii=True, separators=(",", ":"),
                      sort_keys=True).encode("utf-8")
    return StudyReceipt(
        schemaVersion=1,
        kind="M3_OWNER_SEVEN_SEASON_READONLY_FIVE_FOLD_AGGREGATE_RECEIPT",
        revisionSha=code_sha,
        querySha256=sha256(sql_text.encode("utf-8")).hexdigest(),
        aggregateResultsSha256=sha256(canonical).hexdigest(),
        validatedFolds=5,
        candidateScoredMatches=sum(SCORED),
        withheldValidationCandidates=1200 - sum(SCORED),
        poissonBetterLogLossFolds=ll_better,
        poissonBetterBrierFolds=brier_better,
        poissonBetterRpsFolds=rps_better,
    )
