"""Public-only clock conversion and private-safe aggregate refusal tests."""
import json
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_cc0_utc_minute_histogram import (
    audit_public_minute_histogram_receipt,
    public_utc_minute_histogram,
)

EVIDENCE = Path(__file__).resolve().parents[2] / (
    "docs/M3_FIVE_CC0_UTC_MINUTE_HISTOGRAM_EVIDENCE.json"
)


def _receipt():
    return json.loads(EVIDENCE.read_text(encoding="utf-8"))


def test_receipt_fails_to_certify_historical_actual_kickoffs():
    report = audit_public_minute_histogram_receipt(_receipt())
    assert report.public_fixtures == 1200
    assert report.public_available_clock_count == 1153
    assert report.anonymous_exact_minute_overlap == 1116
    assert report.independent_historically_authenticated_kickoffs == 0
    assert report.m3_a3_accepted is False


def test_json_public_clock_converts_moscow_to_utc_without_private_data():
    raw = json.dumps({"matches": [
        {"date": "2018-07-28", "time": "16:30", "score": {"ft": [0, 1]},
         "team1": "PUBLIC_NAME_A", "team2": "PUBLIC_NAME_B"}
        for _ in range(240)
    ]})
    out = public_utc_minute_histogram(raw, "JSON", "2018/19")
    assert out.matches == 240
    assert out.available_clocks == 240
    assert out.missing_clocks == 0
    assert out.minutes == {
        datetime(2018, 7, 28, 13, 30, tzinfo=UTC): 240,
    }
    assert "PUBLIC_NAME_A" not in repr(out)


def test_json_missing_public_clock_stays_missing_not_midnight():
    raw = json.dumps({"matches": [
        {"date": "2019-08-01", "score": {"ft": [1, 0]}}
        for _ in range(240)
    ]})
    out = public_utc_minute_histogram(raw, "JSON", "2019/20")
    assert out.missing_clocks == 240
    assert out.available_clocks == 0
    assert out.minutes == {}


def test_football_txt_public_clock_and_missing_time_inherit_explicit_year():
    raw = "Fri Jul 21 2023\n" + "\n".join(
        "19:00  Club A v Club B  2-1 (0-1)" if i < 219
        else "        Club A v Club B  0-0"
        for i in range(240)
    )
    out = public_utc_minute_histogram(raw, "FOOTBALL_TXT", "2023/24")
    assert out.available_clocks == 219
    assert out.missing_clocks == 21
    assert out.minutes == {datetime(2023, 7, 21, 16, 0, tzinfo=UTC): 219}


@pytest.mark.parametrize("date,time", [
    ("2018-02-30", "15:30"), ("2018-07-28", "27:00"),
    ("2018-07-28", "15:70"), ("2018-07-28", "not-a-clock"),
    ("2018/07/28", "15:00"), ("2018-07-28", "15:00:00"),
])
def test_invented_or_invalid_public_timestamp_refused(date, time):
    raw = json.dumps({"matches": [
        {"date": date, "time": time, "score": {"ft": [0, 0]}}
        for _ in range(240)
    ]})
    with pytest.raises(DataError):
        public_utc_minute_histogram(raw, "JSON", "2018/19")


@pytest.mark.parametrize("fmt,season", [
    ("JSON", "2025/26"), ("JSON", "2026/27"),
    ("JSON", "2021/22"), ("JSON", "2022/23"),
    ("CSV", "2018/19"), ("JSON", "invalid"),
])
def test_unsupported_season_or_source_format_refused(fmt, season):
    raw = json.dumps({"matches": [
        {"date": "2018-08-01", "time": "15:00", "score": {"ft": [0, 0]}}
        for _ in range(240)
    ]})
    with pytest.raises(DataError):
        public_utc_minute_histogram(raw, fmt, season)


@pytest.mark.parametrize("path,key,replacement", [
    ("root", "schemaVersion", True),
    ("root", "kind", "MODEL_DATA"),
    ("root", "scope", "ALL_SEASONS"),
    ("aggregate", "publicClockedRows", 1200),
    ("aggregate", "exactUtcMinuteOverlapCount", 1200),
    ("aggregate", "independentlyCertifiedFixtureKickoffs", 1116),
    ("limitations", "m3A3Accepted", True),
    ("limitations", "realModelTrainingAuthorized", True),
    ("limitations", "holdout2025_26Read", True),
    ("limitations", "publicMissingTimesFilled", True),
    ("limitations", "sourceFirstPublicationUtcVerified", True),
])
def test_receipt_denials_and_counts_immutable(path, key, replacement):
    v = _receipt()
    target = v if path == "root" else v[path]
    target[key] = replacement
    with pytest.raises(DataError):
        audit_public_minute_histogram_receipt(v)


@pytest.mark.parametrize("index,key,replacement", [
    (0, "publicClockedRows", 239),
    (1, "publicWithoutClock", 0),
    (2, "exactUtcMinuteOverlapCount", 238),
    (3, "utcMinuteHistogramL1", 0),
    (4, "privateProviderFinishedRows", 216),
    (3, "originalSourceTimeZoneIndependentlyVerified", True),
    (4, "sourceFirstPublicationVerified", True),
    (0, "conversionAssumption", "LOCAL_TIMEZONE_UNKNOWN"),
])
def test_public_source_clock_or_private_aggregate_mutation_refused(index, key, replacement):
    v = _receipt()
    v["sourceRows"][index][key] = replacement
    with pytest.raises(DataError):
        audit_public_minute_histogram_receipt(v)


def test_extra_private_identifiers_refused():
    v = deepcopy(_receipt())
    v["sourceRows"][0]["privateClubId"] = "BLOCKED"
    with pytest.raises(DataError):
        audit_public_minute_histogram_receipt(v)

def test_wrong_year_and_disguised_holdout_dates_refused():
    raw = json.dumps({"matches": [
        {"date": "2025-07-25", "time": "13:00", "score": {"ft": [0, 0]}}
        for _ in range(240)
    ]})
    with pytest.raises(DataError):
        public_utc_minute_histogram(raw, "JSON", "2018/19")


def test_covid_extended_2019_20_july_remains_in_bounds():
    raw = json.dumps({"matches": [
        {"date": "2020-07-20", "time": "15:00", "score": {"ft": [0, 0]}}
        for _ in range(240)
    ]})
    got = public_utc_minute_histogram(raw, "JSON", "2019/20")
    assert got.available_clocks == 240
    assert got.minutes == {datetime(2020, 7, 20, 12, 0, tzinfo=UTC): 240}
