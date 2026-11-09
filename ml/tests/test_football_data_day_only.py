"""Fully synthetic day-only RPL evaluation adapter tests. NO real 2025 results."""
import csv
from dataclasses import replace
from datetime import date, timedelta
from hashlib import sha256
from io import StringIO

import pytest
from test_openfootball_training import fixture_doc

from football_forecast.data.contracts import DataError
from football_forecast.data.openfootball_training import (
    PROTOCOL,
    read_openfootball_calendar_training,
)
from football_forecast.models.team_strength import fit_independent_poisson
from football_forecast.research import football_data_day_only as module
from football_forecast.research.model_escrow import (
    _fingerprint_for_protocol,
    serialize_private_model,
)
from football_forecast.research.openfootball_crosswalk import (
    OFFICIAL_2025_FINAL_ROSTER,
    TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL,
    _train_alias,
)


def synthetic_csv() -> bytes:
    ordered = list(OFFICIAL_2025_FINAL_ROSTER)
    fields = ("Country", "League", "Season", "Date", "Time",
              "Home", "Away", "HG", "AG", "Res")
    stream = StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerow({
        "Country": "Russia", "League": "Premier League", "Season": "2024",
        "Date": "01/09/24", "Time": "14:00",
        "Home": "Zenit", "Away": "Spartak", "HG": 2, "AG": 1, "Res": "H",
    })
    for r in range(15):
        for leg in range(2):
            day = date(2025, 8, 1) + timedelta(days=r+15*leg)
            for idx in range(8):
                h, a = ordered[idx], ordered[15-idx]
                if leg:
                    h, a = a, h
                hg, ag = idx % 3, idx % 2
                writer.writerow({
                    "Country": "Russia", "League": "Premier League", "Season": "2025",
                    "Date": day.strftime("%d/%m/%y"), "Time": "15:00",
                    "Home": module._NAME_ALIASES[h][0],
                    "Away": module._NAME_ALIASES[a][0],
                    "HG": hg, "AG": ag,
                    "Res": "H" if hg > ag else "D" if hg == ag else "A",
                })
        ordered = [ordered[0], ordered[-1], *ordered[1:-1]]
    writer.writerow({
        "Country": "Russia", "League": "Premier League", "Season": "2026",
        "Date": "01/09/26", "Time": "14:00",
        "Home": "Zenit", "Away": "Spartak", "HG": 1, "AG": 0, "Res": "H",
    })
    return stream.getvalue().encode("utf-8")


@pytest.fixture
def prepared(monkeypatch):
    document = fixture_doc()
    rows, _ = read_openfootball_calendar_training(document)
    model = fit_independent_poisson(rows)
    # Synthetic coefficients, but the EXACT predeclared frozen 2024 club
    # aliases. Otherwise provider-independent roster validation correctly
    # rejects unrelated synthetic team names before reaching metric tests.
    model = replace(model, teams=tuple(sorted(
        _train_alias(name)
        for name in TRAIN_2024_PUBLIC_NAME_TO_OPENFOOTBALL.values()
    )))
    train_bytes = serialize_private_model(model, protocol=PROTOCOL)
    monkeypatch.setattr(
        module, "_FROZEN_MODEL_ARTIFACT", sha256(train_bytes).hexdigest(),
    )
    monkeypatch.setattr(
        module, "_FROZEN_MODEL_FITTED",
        _fingerprint_for_protocol(model, PROTOCOL),
    )
    blob = synthetic_csv()
    batch = module.parse_russian_2025_csv(blob)
    return model, blob, batch


def score(model, source_batch, **overrides):
    kw = {
        "model": model, "batch": source_batch,
        "expected_source_sha256": source_batch.source_sha256,
        "expected_cohort_sha256": source_batch.cohort_sha256,
        "expected_name_policy_sha256": module._NAME_POLICY_SHA,
    }
    kw.update(overrides)
    return module.score_fixed_day_only(**kw)


def test_older_source_schema_drift_does_not_invalidate_fixed_holdout(prepared):
    _model, blob, cohort = prepared
    lines = blob.decode("utf-8").splitlines()
    # Historical rows have sometimes lacked later-added odds/stat columns.
    # An old record ending before the final field is NOT a 2025/26 defect.
    lines[1] = lines[1].rsplit(",", 1)[0]
    parsed = module.parse_russian_2025_csv(("\n".join(lines) + "\n").encode())
    assert len(parsed.fixtures) == 240
    assert parsed.cohort_sha256 == cohort.cohort_sha256


def test_synthetic_full_calendar_parses_only_target_season(prepared):
    _model, blob, batch = prepared
    assert len(batch.fixtures) == 240
    assert batch.source_sha256 == sha256(blob).hexdigest()
    assert batch.name_policy_sha256 == module._NAME_POLICY_SHA
    assert all(f.day.year == 2025 for f in batch.fixtures)
    assert len({(f.home_official, f.away_official) for f in batch.fixtures}) == 240
    assert batch == module.parse_russian_2025_csv(blob)


def test_fixed_model_metrics_are_deterministic_and_182_58(prepared):
    model, _blob, batch = prepared
    result = score(model, batch)
    assert result == score(model, batch)
    assert result.metrics.count == 182
    assert result.metrics.exclusions_unseen_club == 58
    report = result.as_dict()
    assert report["eligibleMatches"] == 182
    assert report["unseenClubAbstentions"] == 58
    assert report["datePrecision"] == "DAY_ONLY"
    assert report["kickoffTimesAuthenticated"] is False
    assert report["strictHistoricalAsOfVerified"] is False
    assert 0 <= report["modelTop1Accuracy"] <= 1
    assert 0 <= report["trainingPriorTop1Accuracy"] <= 1
    assert report["productionForecastsWritten"] == 0
    assert report["calibrationOrSuperiorityClaimed"] is False
    assert report["researchClassification"] == "NON_STRICT_RETROSPECTIVE"
    assert report["sourceDataPublished"] is False
    assert all(x is not None and 0 <= x < 10 for x in (
        result.metrics.model_log_loss,
        result.metrics.model_brier,
        result.metrics.model_rps,
        result.metrics.training_prior_log_loss,
        result.metrics.training_prior_brier,
        result.metrics.training_prior_rps,
    ))
    assert "Akron" not in str(report)
    assert "S_" not in str(report)
    assert "U_" not in str(report)


def test_untrusted_timezone_is_never_inferred_from_time_field(prepared):
    _model, blob, cohort = prepared
    altered = blob.replace(b",15:00,", b",23:30,")
    result = module.parse_russian_2025_csv(altered)
    assert result.source_sha256 != cohort.source_sha256
    assert result.cohort_sha256 == cohort.cohort_sha256


def test_sealed_bytes_are_bound_to_expected_separately_recorded_digest(prepared):
    model, _blob, cohort = prepared
    for kwargs in (
        {"expected_source_sha256": "0"*64},
        {"expected_cohort_sha256": "f"*64},
        {"expected_name_policy_sha256": "2"*64},
        {"batch": replace(cohort, fixtures=cohort.fixtures[:-1])},
    ):
        with pytest.raises(DataError):
            score(model, cohort, **kwargs)
    with pytest.raises(DataError):
        module.score_fixed_day_only(
            model=model, batch=cohort,
            expected_source_sha256=cohort.source_sha256,
            expected_cohort_sha256=cohort.cohort_sha256,
            expected_name_policy_sha256="mismatched",
        )
    with pytest.raises(DataError):
        module.score_fixed_day_only(
            model=object(), batch=cohort,
            expected_source_sha256=cohort.source_sha256,
            expected_cohort_sha256=cohort.cohort_sha256,
            expected_name_policy_sha256=cohort.name_policy_sha256,
        )


def test_model_escrow_refuses_mismatched_artifact(prepared, monkeypatch):
    model, _blob, cohort = prepared
    monkeypatch.setattr(module, "_FROZEN_MODEL_ARTIFACT", "a"*64)
    with pytest.raises(DataError):
        score(model, cohort)


def test_bad_scores_unknown_names_and_duplicate_directions_fail_closed(prepared):
    _model, blob, _cohort = prepared
    raw = blob.decode("utf-8")
    for replaced in (
        raw.replace("Zenit", "Fake Team"),
        raw.replace("Zenit", "Torpedo"),
        raw.replace(",0,0,D", ",21,0,H", 1),
        raw.replace(",0,0,D", ",0,0,H", 1),
        raw.replace("01/08/25", "not-a-date", 1),
        raw.replace("Akron", "Spartak", 1),
    ):
        if replaced == raw:
            continue
        with pytest.raises(DataError):
            module.parse_russian_2025_csv(replaced.encode())
    with pytest.raises(DataError):
        module.parse_russian_2025_csv(blob[:20])


def test_extra_or_missing_target_rows_fail_closed(prepared):
    _model, blob, _cohort = prepared
    text = blob.decode()
    rows = text.splitlines()
    header, other, *games_and_last = rows
    assert other.startswith("Russia,")
    with pytest.raises(DataError):
        module.parse_russian_2025_csv(("\n".join([header, other, *games_and_last[:-2]])+"\n").encode())
    with pytest.raises(DataError):
        module.parse_russian_2025_csv((text + rows[2] + "\n").encode())
    with pytest.raises(DataError):
        module.parse_russian_2025_csv(
            text.replace("Home,Away,HG,AG,Res", "Home,Away,HG,AG").encode(),
        )


def test_incomplete_coverage_cannot_be_scored_with_synthetic_labels(prepared):
    model, _blob, batch = prepared
    changed = tuple(replace(f, home_official="Сочи") if f.home_official == "Зенит"
                    else f for f in batch.fixtures)
    with pytest.raises(DataError):
        score(model, replace(batch, fixtures=changed))


def test_csv_parse_does_not_perform_network_or_rewrite_study_lock():
    assert module._SOURCE == "https://www.football-data.co.uk/new/RUS.csv"
    assert module._FROZEN_HDA == (103, 65, 72)
    assert module._NAME_POLICY_SHA and len(module._NAME_POLICY_SHA) == 64
    assert set(module._NAME_ALIASES) == set(OFFICIAL_2025_FINAL_ROSTER)
    assert not hasattr(module, "fetch")
    assert not hasattr(module, "train")
