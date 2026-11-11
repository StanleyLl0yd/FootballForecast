"""Pure synthetic cross-source structural correlation, no private IO."""
from dataclasses import replace
from datetime import UTC, datetime

import pytest
from test_m3_rsssf_match_schedule import synthetic_source

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_private_public_two_season_graph import (
    PrivateFixture,
    audit_two_season_fixture_correspondence,
)
from football_forecast.research.m3_rsssf_match_schedule import (
    parse_rsssf_rpl,
)


def sources():
    public = tuple(
        row
        for season in ("2021/22", "2022/23")
        for row in parse_rsssf_rpl(synthetic_source(season), season)
    )
    # Canonical stable IDs across both synthetic years, including the two
    # explicitly documented aliases (Ahmat/Akhmat, NNovgorod/Pari NN).
    def club(alias: str) -> str:
        return "synthetic_" + {"Ahmat": "Akhmat", "NNovgorod": "Pari NN"}.get(alias, alias)

    private = tuple(PrivateFixture(
        season=p.season,
        kickoff_at=datetime(p.day.year, p.day.month, p.day.day, 12, tzinfo=UTC),
        home_team_id=club(p.home), away_team_id=club(p.away),
        home_goals=p.home_goals, away_goals=p.away_goals,
        status="finished",
    ) for p in public)
    return public, private


def test_all_480_synthetic_date_side_links_and_revised_exclusion():
    p, q = sources()
    audit = audit_two_season_fixture_correspondence(p, q)
    assert audit.nominal_public_fixtures == audit.nominal_private_fixtures == 480
    assert [s.independently_mapped_clubs for s in audit.seasons] == [16, 16]
    assert [s.date_direction_correspondences for s in audit.seasons] == [240, 240]
    assert [s.candidate_played_score_agreements for s in audit.seasons] == [240, 239]
    assert audit.total_date_direction_correspondences == 480
    assert audit.candidate_played_score_agreements == 479
    assert audit.total_official_score_disagreements == 0
    assert audit.shared_clubs_between_seasons == 13
    assert audit.shared_clubs_with_stable_provider_id == 13
    assert audit.all_fixture_graphs_resolved is True
    assert audit.classification == "RETROSPECTIVE_STRUCTURAL_CANDIDATE_NOT_STRICT_AS_OF"
    assert not audit.real_training_authorized
    assert not audit.sealed_holdout_read and not audit.private_ids_exported


def test_private_score_mutation_does_not_change_date_only_club_mapping():
    p, q = sources()
    changed = (replace(q[0], home_goals=8), *q[1:])
    audit = audit_two_season_fixture_correspondence(p, changed)
    assert audit.seasons[0].independently_mapped_clubs == 16
    assert audit.total_date_direction_correspondences == 480
    assert audit.total_official_score_disagreements == 1
    assert not audit.all_fixture_graphs_resolved


def test_private_date_change_produces_unresolved_identity_not_score_seed():
    p, q = sources()
    m = q[0]
    changed = (replace(m, kickoff_at=m.kickoff_at.replace(day=10)), *q[1:])
    audit = audit_two_season_fixture_correspondence(p, changed)
    assert audit.total_date_direction_correspondences < 480
    assert not audit.all_fixture_graphs_resolved


def test_provider_id_changed_between_seasons_is_detected():
    p, q = sources()
    second = tuple(replace(row,
        home_team_id=("different_Akhmat" if row.home_team_id == "synthetic_Akhmat"
                      else row.home_team_id),
        away_team_id=("different_Akhmat" if row.away_team_id == "synthetic_Akhmat"
                      else row.away_team_id),
    ) if row.season == "2022/23" else row for row in q)
    audit = audit_two_season_fixture_correspondence(p, second)
    assert audit.all_fixture_graphs_resolved
    assert audit.shared_clubs_with_stable_provider_id == 12


@pytest.mark.parametrize("mutation", [
    "bad_status", "invalid_score", "duplicate_pair", "no_timezone", "extra_season",
])
def test_invalid_private_source_refused(mutation):
    p, q = sources()
    m = q[0]
    value = {
        "bad_status": replace(m, status="awarded"),
        "invalid_score": replace(m, home_goals=-1),
        "duplicate_pair": q[1],
        "no_timezone": replace(m, kickoff_at=m.kickoff_at.replace(tzinfo=None)),
        "extra_season": replace(m, season="2025/26"),
    }[mutation]
    with pytest.raises(DataError):
        audit_two_season_fixture_correspondence(p, (value, *q[1:]))


def test_missing_source_year_refused():
    p, q = sources()
    with pytest.raises(DataError):
        audit_two_season_fixture_correspondence(p[:-1], q)
    with pytest.raises(DataError):
        audit_two_season_fixture_correspondence(p, q[:-1])
