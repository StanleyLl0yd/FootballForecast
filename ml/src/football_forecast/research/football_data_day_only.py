"""Private, day-precision 2025/26 Russian Premier League scoring candidate.

Only parses supplied bytes. No I/O, network, database, source selection,
model fitting, retries, output publication or holdout authorization.
The protected one-use runner must freeze source, model, official-name aliases,
study code, owner authorization and evaluation policy BEFORE obtaining labels.

Football-Data's extra-league RUS.csv spans several seasons. Never treat its
undocumented Time timezone as an authenticated UTC kickoff. This is a fixed
2024/25 model evaluated RETROSPECTIVELY for season outcomes, not an as-of model.
"""
import csv
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
from hashlib import sha256
from io import StringIO
from math import fsum
from re import fullmatch

from football_forecast.data.contracts import DataError
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
from football_forecast.research.openfootball_crosswalk import (
    OFFICIAL_2025_FINAL_ROSTER,
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
    prepare_provider_independent_name_policy,
)

_SOURCE = "https://www.football-data.co.uk/new/RUS.csv"
_FROZEN_MODEL_ARTIFACT = (
    "5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d"
)
_FROZEN_MODEL_FITTED = (
    "987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d"
)
_FROZEN_HDA = (103, 65, 72)
_START = date(2025, 7, 1)
_END = date(2026, 7, 1)

# Frozen before source labels are opened. Exact case-insensitive source
# spellings, not approximate string-matching or match-result driven aliases.
# Missing names MUST fail this first study; no corrective tuning on holdout.
_NAME_ALIASES: dict[str, tuple[str, ...]] = {
    "Акрон": ("Akron", "Akron Tolyatti", "Akron Togliatti", "Akron Tolyaty"),
    "Ахмат": ("Akhmat", "Akhmat Grozny", "Akhmat Grozny FC"),
    "Балтика": ("Baltika", "Baltika Kaliningrad", "Baltika Kgd"),
    "Динамо Махачкала": (
        "Dinamo Makhachkala", "Dynamo Makhachkala", "FK Dinamo Makhachkala",
        "Dynamo Makhachkala FC",
    ),
    "Динамо Москва": ("Dinamo Moscow", "Dynamo Moscow", "Dinamo Moskva"),
    "Зенит": ("Zenit", "Zenit St Petersburg", "Zenit St. Petersburg", "Zenit SPb"),
    "Краснодар": ("Krasnodar", "FC Krasnodar", "FK Krasnodar"),
    "Крылья Советов": (
        "Krylya Sovetov", "Krylia Sovetov", "Krylya Sovetov Samara",
        "Krylia Sovetov Samara",
    ),
    "Локомотив": (
        "Lokomotiv Moscow", "Lokomotiv Moskva", "Lokomotiv", "Lokomotiv M",
    ),
    "Оренбург": ("Orenburg", "FK Orenburg", "FC Orenburg"),
    "Пари НН": (
        "Nizhny Novgorod", "Nizhniy Novgorod", "Nizhni Novgorod",
        "Pari NN", "Pari Nizhny Novgorod",
    ),
    "Ростов": ("Rostov", "FK Rostov", "FC Rostov"),
    "Рубин": ("Rubin Kazan", "Rubin", "Rubin Kazan FC"),
    "Сочи": ("Sochi", "FC Sochi", "PFC Sochi"),
    "Спартак": ("Spartak Moscow", "Spartak Moskva", "Spartak"),
    "ЦСКА": ("CSKA Moscow", "CSKA Moskva", "CSKA", "CSKA Moscow FC"),
}
_NAME_TO_OFFICIAL = {
    variant.casefold(): official
    for official, variants in _NAME_ALIASES.items()
    for variant in variants
}
if len(_NAME_TO_OFFICIAL) != sum(len(v) for v in _NAME_ALIASES.values()):
    raise RuntimeError("M2 predeclared spelling map collision")
if set(_NAME_ALIASES) != set(OFFICIAL_2025_FINAL_ROSTER):
    raise RuntimeError("M2 source names differ from official roster")

_NAME_POLICY_SHA = _digest({
    "schemaVersion": 1,
    "source": _SOURCE,
    "modelProtocol": PROTOCOL,
    "season": "2025/2026",
    "nameVariants": _NAME_ALIASES,
    "datePrecision": "DAY_ONLY",
    "select": "calendar_date_2025-07-01_through_2026-06-30",
    "unseenClubPolicy": "ABSTAIN",
    "metricOrder": ("H", "D", "A"),
    "expectedEligible": 182,
    "expectedAbstentions": 58,
})


@dataclass(frozen=True, slots=True)
class DayFixture:
    day: date
    home_official: str
    away_official: str
    home_goals: int
    away_goals: int


@dataclass(frozen=True, slots=True)
class DayCohort:
    source_sha256: str
    cohort_sha256: str
    name_policy_sha256: str
    fixtures: tuple[DayFixture, ...]


@dataclass(frozen=True, slots=True)
class DayScore:
    metrics: NonStrictAggregateResult
    source_sha256: str
    cohort_sha256: str
    name_policy_sha256: str
    model_top1_accuracy: float
    training_prior_top1_accuracy: float

    def as_dict(self) -> dict[str, object]:
        report = self.metrics.as_dict()
        report.update({
            "sourceSha256": self.source_sha256,
            "selectedSeasonRowsSha256": self.cohort_sha256,
            "predeclaredNamesPolicySha256": self.name_policy_sha256,
            "sourceUrl": _SOURCE,
            "season": "2025/2026",
            "totalFinishedMatches": 240,
            "eligibleMatches": 182,
            "unseenClubAbstentions": 58,
            "datePrecision": "DAY_ONLY",
            "kickoffTimesAuthenticated": False,
            "modelTop1Accuracy": self.model_top1_accuracy,
            "trainingPriorTop1Accuracy": self.training_prior_top1_accuracy,
            "sourceDataPublished": False,
        })
        return report


def _day(value: str) -> date | None:
    if not value or len(value) > 10:
        return None
    try:
        parsed = datetime.strptime(value, "%d/%m/%y").date()
        return parsed
    except ValueError:
        pass
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return None


def _goal(value: str) -> int:
    if type(value) is not str or fullmatch(r"[0-9]{1,2}", value) is None:
        raise DataError("M2 day-only: invalid numeric played score")
    goal = int(value)
    if goal > 20:
        raise DataError("M2 day-only: score exceeds bounded limit")
    return goal


def parse_russian_2025_csv(blob: bytes) -> DayCohort:
    """Select only 2025/26 from the all-seasons archive, with no network I/O.

    Date is day precision only; Time is deliberately ignored because source
    timezone is not certified. Any incomplete/awarded/duplicated cohort fails.
    """
    if type(blob) is not bytes or not 100 < len(blob) <= 15_000_000:
        raise DataError("M2 day-only: bounded original CSV required")
    try:
        decoded = blob.decode("utf-8-sig")
    except UnicodeError:
        decoded = blob.decode("cp1252")
    if "\x00" in decoded:
        raise DataError("M2 day-only: NUL in original source")
    try:
        reader = csv.DictReader(StringIO(decoded, newline=""), strict=True)
        header = reader.fieldnames
        if (header is None or len(header) > 150 or len(set(header)) != len(header)
                or not {"Date", "Home", "Away", "HG", "AG", "Res"}.issubset(header)):
            raise DataError("M2 day-only: unrecognized official archive columns")
        fixtures: list[DayFixture] = []
        for row in reader:
            if len(fixtures) > 240:
                raise DataError("M2 day-only: too many selected matches")
            if None in row or any(value is None for value in row.values()):
                # Extra-league historical CSV must stay structurally valid.
                raise DataError("M2 day-only: malformed CSV record")
            date_value = _day(row["Date"])
            if date_value is None or not _START <= date_value < _END:
                continue
            home = _NAME_TO_OFFICIAL.get(row["Home"].casefold())
            away = _NAME_TO_OFFICIAL.get(row["Away"].casefold())
            if home is None or away is None:
                raise DataError("M2 day-only: undeclared team naming")
            hg, ag = _goal(row["HG"]), _goal(row["AG"])
            expected_res = "H" if hg > ag else "D" if hg == ag else "A"
            if row["Res"] != expected_res:
                raise DataError("M2 day-only: provider result disagrees with score")
            fixtures.append(DayFixture(date_value, home, away, hg, ag))
    except (csv.Error, UnicodeError, OSError) as exc:
        raise DataError("M2 day-only: unreadable source CSV") from exc
    if len(fixtures) != 240:
        raise DataError("M2 day-only: incomplete 2025/26 calendar")
    identifiers: set[tuple[str, str]] = set()
    days: set[tuple[str, date]] = set()
    home_counts: Counter[str] = Counter()
    away_counts: Counter[str] = Counter()
    for game in fixtures:
        pair = (game.home_official, game.away_official)
        if game.home_official == game.away_official or pair in identifiers:
            raise DataError("M2 day-only: invalid or repeated direction")
        identifiers.add(pair)
        for club in pair:
            if (club, game.day) in days:
                raise DataError("M2 day-only: club plays twice on one listed date")
            days.add((club, game.day))
        home_counts[game.home_official] += 1
        away_counts[game.away_official] += 1
    if (set(home_counts) != set(OFFICIAL_2025_FINAL_ROSTER)
            or set(away_counts) != set(OFFICIAL_2025_FINAL_ROSTER)
            or any(home_counts[c] != 15 or away_counts[c] != 15
                   for c in OFFICIAL_2025_FINAL_ROSTER)):
        raise DataError("M2 day-only: incomplete 16-team double round robin")
    fixtures.sort(key=lambda f: (f.day, f.home_official, f.away_official))
    canonical = [[f.day.isoformat(), f.home_official, f.away_official,
                  f.home_goals, f.away_goals] for f in fixtures]
    return DayCohort(
        source_sha256=sha256(blob).hexdigest(),
        cohort_sha256=_digest(canonical),
        name_policy_sha256=_NAME_POLICY_SHA,
        fixtures=tuple(fixtures),
    )


def score_fixed_day_only(
    *, model: TeamStrengthModel, batch: DayCohort,
    expected_source_sha256: str, expected_cohort_sha256: str,
    expected_name_policy_sha256: str,
) -> DayScore:
    """Pure scoring AFTER separately anchored source/one-use authorization.

    The caller must verify protected immutable study and selected source SHA
    before passing data. Passing matching hashes to this function is not proof
    of authorization; do NOT invoke on 2025/26 outside the trusted worker.
    """
    if (type(batch) is not DayCohort or type(model) is not TeamStrengthModel
            or type(batch.fixtures) is not tuple
            or any(type(f) is not DayFixture for f in batch.fixtures)
            or batch.cohort_sha256 != _digest([
                [f.day.isoformat(), f.home_official, f.away_official,
                 f.home_goals, f.away_goals] for f in batch.fixtures
            ])
            or batch.source_sha256 != expected_source_sha256
            or batch.cohort_sha256 != expected_cohort_sha256
            or batch.name_policy_sha256 != expected_name_policy_sha256
            or batch.name_policy_sha256 != _NAME_POLICY_SHA
            or len(batch.fixtures) != 240):
        raise DataError("M2 day-only: missing committed source/crosswalk")
    canonical = serialize_private_model(model, protocol=PROTOCOL)
    if (sha256(canonical).hexdigest() != _FROZEN_MODEL_ARTIFACT
            or _fingerprint_for_protocol(model, PROTOCOL) != _FROZEN_MODEL_FITTED):
        raise DataError("M2 day-only: model escrow differs from frozen train-only fit")
    official = prepare_provider_independent_name_policy(
        model_team_aliases=model.teams,
    )
    prior = tuple(x / 240 for x in _FROZEN_HDA)
    model_scores: list[tuple[float, float, float]] = []
    baseline_scores: list[tuple[float, float, float]] = []
    model_hits = 0
    prior_hits = 0
    unseen = 0
    for f in batch.fixtures:
        home = official.resolve_official_name(f.home_official)
        away = official.resolve_official_name(f.away_official)
        outcome = 0 if f.home_goals > f.away_goals else 1 if f.home_goals == f.away_goals else 2
        try:
            pred = model.predict(home, away)
        except InsufficientTrainingData:
            unseen += 1
            continue
        scores = (pred.home_win, pred.draw, pred.away_win)
        model_scores.append((
            log_loss(scores, outcome), brier_score(scores, outcome),
            ranked_probability_score(scores, outcome),
        ))
        baseline_scores.append((
            log_loss(prior, outcome), brier_score(prior, outcome),
            ranked_probability_score(prior, outcome),
        ))
        model_hits += int(max(range(3), key=scores.__getitem__) == outcome)
        prior_hits += int(max(range(3), key=prior.__getitem__) == outcome)
    count = len(model_scores)
    if (count != 182 or unseen != 58):
        raise DataError("M2 day-only: preregistered 182/58 cohort coverage differs")
    def average(values: list[tuple[float, float, float]], col: int) -> float:
        return fsum(x[col] for x in values) / count
    return DayScore(
        metrics=NonStrictAggregateResult(
            count=count, exclusions_unseen_club=unseen,
            model_log_loss=average(model_scores, 0),
            model_brier=average(model_scores, 1),
            model_rps=average(model_scores, 2),
            training_prior_log_loss=average(baseline_scores, 0),
            training_prior_brier=average(baseline_scores, 1),
            training_prior_rps=average(baseline_scores, 2),
        ),
        source_sha256=batch.source_sha256,
        cohort_sha256=batch.cohort_sha256,
        name_policy_sha256=batch.name_policy_sha256,
        model_top1_accuracy=model_hits / count,
        training_prior_top1_accuracy=prior_hits / count,
    )
