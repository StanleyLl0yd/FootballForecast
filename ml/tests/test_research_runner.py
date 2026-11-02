"""Synthetic-only private M2 runner preparation; never requires DB credentials."""
import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.runner import training_only_mapping
from test_research_lock import rows


def test_training_only_club_mapping_is_stable_and_not_label_dependent():
    dataset = rows()
    teams = {t for row in dataset for t in (row[4], row[5])}
    mapping = training_only_mapping(teams)
    assert len(mapping) == 16 and len(set(mapping.values())) == 16
    assert mapping == training_only_mapping(set(reversed(sorted(teams))))
    assert all(len(label) == 22 and label.startswith("S_") for label in mapping.values())
    assert not any(value in teams for value in mapping.values())
    assert mapping["src-00"] != mapping["src-01"]


@pytest.mark.parametrize("clubs", [
    set(),
    {"src-00"},
    {"src-00"} | {f"src-{i:02}" for i in range(1, 15)},
    {f"src-{i:02}" for i in range(15)} | {""},
    {f"src-{i:02}" for i in range(15)} | {"x" * 101},
])
def test_reject_bad_mapping_source_cohorts(clubs):
    with pytest.raises(DataError):
        training_only_mapping(clubs)


def test_runner_is_importable_without_database_driver_or_credentials():
    from football_forecast.research import runner
    assert runner.main is not None
