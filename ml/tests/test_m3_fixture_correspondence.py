"""M3 fixture triage: synthetic seven-year cross-provider safety tests."""
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from json import dumps

import pytest
from test_rpl_development_folds import synthetic_corpus

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_fixture_correspondence import (
    DeclaredSeasonClubLink,
    IndependentReferenceFixture,
    PrivateDevelopmentFixture,
    REASONS,
    RESEARCH_PROTOCOL,
    audit_independent_fixture_candidates,
)
from football_forecast.research.rpl_temporal_features import DEVELOPMENT_SEASONS


@pytest.fixture(scope="module")
def corpus():
    private = []
    independent = []
    links = []
    for season in DEVELOPMENT_SEASONS:
        links.extend(DeclaredSeasonClubLink(season, f"club_{i}", f"public_{i}")
                     for i in range(16))
    for i, r in enumerate(synthetic_corpus()):
        private.append(PrivateDevelopmentFixture(
            r.season, r.source_match_id, r.home_team_id, r.away_team_id,
            r.kickoff_at, r.home_goals, r.away_goals,
        ))
        independent.append(IndependentReferenceFixture(
            season=r.season, reference_id=f"synthetic_ref_{i}",
            home_club=f"public_{r.home_team_id.removeprefix('club_')}",
            away_club=f"public_{r.away_team_id.removeprefix('club_')}",
            event_day_utc=r.kickoff_at.date(), result_kind="played",
            home_played_goals=r.home_goals, away_played_goals=r.away_goals,
            source_namespace="openfootball-json-pinned",
            source_content_sha256="a" * 64,
        ))
    return tuple(private), tuple(independent), tuple(links)


def _counts(result, year: str) -> dict[str, int]:
    return dict(next(x for x in result.seasons if x.season == year).outcome_counts)


def _modify_reference(corpus, index, **changes):
    private, references, links = corpus
    return private, (*references[:index], replace(references[index], **changes),
                     *references[index + 1:]), links


def test_perfect_synthetic_agreement_does_not_grant_real_training(corpus):
    private, references, links = corpus
    report = audit_independent_fixture_candidates(private, references, links)
    assert report.protocol == RESEARCH_PROTOCOL
    assert report.private_fixture_count == 1680
    assert report.public_reference_fixture_count == 1680
    assert report.candidate_played_agreements == 1680
    assert report.ambiguous_or_rejected == 0
    assert len(report.seasons) == 7
    assert all(r.private_fixture_count == 240 and r.public_reference_fixture_count == 240
               and dict(r.outcome_counts)["CANDIDATE_PLAYED_AGREEMENT"] == 240
               for r in report.seasons)
    assert all(tuple(key for key, _ in r.outcome_counts) == REASONS
               for r in report.seasons)
    assert report.independently_eligible_private_rows == 0
    assert not report.real_training_authorized
    assert not report.heldout_2025_26_read
    assert not report.model_fitted and not report.raw_identifiers_exposed
    assert report.classification == "NON_STRICT_RETROSPECTIVE"
    serialized = dumps(report, default=lambda o: {
        name: getattr(o, name) for name in o.__dataclass_fields__
    })
    assert "synthetic_2018_" not in serialized
    assert "public_0" not in serialized
    assert "club_0" not in serialized
    assert "a" * 64 not in serialized


def test_crosswalk_comparison_is_invariant_to_input_order(corpus):
    p, r, links = corpus
    expected = audit_independent_fixture_candidates(p, r, links)
    assert audit_independent_fixture_candidates(
        tuple(reversed(p)), tuple(reversed(r)), tuple(reversed(links))
    ) == expected


@pytest.mark.parametrize(("kind", "changes", "reason"), [
    ("award", {"result_kind": "technical_award",
               "home_played_goals": None, "away_played_goals": None},
     "TECHNICAL_RESULT"),
    ("revised", {"result_kind": "revised_official",
                 "home_played_goals": None, "away_played_goals": None},
     "REVISED_OFFICIAL_RESULT"),
    ("unknown", {"result_kind": "unclassified",
                 "home_played_goals": None, "away_played_goals": None},
     "STATUS_UNCLASSIFIED"),
    ("score_missing", {"away_played_goals": None}, "SCORE_UNVERIFIED"),
    ("score_changed", {"home_played_goals": 20}, "SCORE_CONFLICT"),
])
def test_unsafe_public_result_never_counts_as_played_agreement(corpus, kind, changes,
                                                                reason):
    p, r, links = _modify_reference(corpus, 0, **changes)
    result = audit_independent_fixture_candidates(p, r, links)
    assert _counts(result, "2018/19")[reason] == 1, kind
    assert _counts(result, "2018/19")["CANDIDATE_PLAYED_AGREEMENT"] == 239
    assert result.candidate_played_agreements == 1679
    assert not result.real_training_authorized


def test_source_date_drift_is_reported_not_automatically_repaired(corpus):
    p, r, links = corpus
    p, r, links = _modify_reference(
        (p, r, links), 0, event_day_utc=r[0].event_day_utc + timedelta(days=1)
    )
    report = audit_independent_fixture_candidates(p, r, links)
    assert _counts(report, "2018/19")["DATE_CONFLICT"] == 1
    assert report.candidate_played_agreements == 1679


def test_home_away_inversion_is_quarantined_and_not_flipped(corpus):
    p, r, links = corpus
    p, r, links = _modify_reference(
        (p, r, links), 0, home_club=r[0].away_club, away_club=r[0].home_club
    )
    report = audit_independent_fixture_candidates(p, r, links)
    assert _counts(report, "2018/19")["HOME_AWAY_CONFLICT"] >= 1
    assert report.candidate_played_agreements < 1680
    assert not report.real_training_authorized


def test_duplicated_reference_pair_is_ambiguous_even_with_one_exact_date(corpus):
    p, r, links = corpus
    duplicate = replace(
        r[1], home_club=r[0].home_club, away_club=r[0].away_club,
        event_day_utc=r[0].event_day_utc
    )
    corrupt = (r[0], duplicate, *r[2:])
    report = audit_independent_fixture_candidates(p, corrupt, links)
    assert _counts(report, "2018/19")["REFERENCE_AMBIGUOUS"] >= 1
    assert report.candidate_played_agreements < 1680


def test_missing_reference_and_missing_club_mapping_are_distinct(corpus):
    p, r, links = corpus
    report = audit_independent_fixture_candidates(p, r[:-1], links)
    assert _counts(report, "2024/25")["REFERENCE_MISSING"] == 1
    assert report.candidate_played_agreements == 1679
    absent_links = tuple(x for x in links if not (
        x.season == "2018/19" and x.private_team_id == "club_0"
    ))
    report = audit_independent_fixture_candidates(p, r, absent_links)
    assert _counts(report, "2018/19")["IDENTITY_UNMAPPED"] == 30
    assert report.candidate_played_agreements == 1650
    assert not report.real_training_authorized


def test_no_reference_cannot_be_silently_promoted_to_positive_label(corpus):
    p, _r, links = corpus
    report = audit_independent_fixture_candidates(p, (), links)
    assert report.candidate_played_agreements == 0
    assert report.ambiguous_or_rejected == 1680
    assert sum(_counts(report, season)["REFERENCE_MISSING"] for season in DEVELOPMENT_SEASONS
               ) == 1680


@pytest.mark.parametrize("change", [
    {"season": "2025/26"},
    {"home_goals": -1},
    {"away_goals": 21},
    {"status": "awarded"},
    {"home_team_id": "club_15" },
    {"kickoff_utc": datetime(2017, 8, 1, tzinfo=UTC)},
    {"kickoff_utc": datetime(2018, 8, 1)},
])
def test_sealed_invalid_or_wrongly_asserted_private_input_fails_closed(corpus, change):
    p, r, links = corpus
    with pytest.raises(DataError, match="M3 fixture triage"):
        audit_independent_fixture_candidates(
            (replace(p[0], **change), *p[1:]), r, links
        )


@pytest.mark.parametrize("change", [
    {"season": "2025/26"},
    {"source_namespace": "openfoot-starter"},
    {"source_namespace": []},
    {"source_content_sha256": "non_verifiable"},
    {"result_kind": []},
    {"result_kind": "made_up"},
    {"result_kind": "technical_award"},
    {"event_day_utc": "2018-09-01"},
    {"home_played_goals": -1},
    {"home_club": "public_15"},
])
def test_reference_provenance_status_and_identity_conflicts_fail_closed(corpus, change):
    p, r, links = corpus
    with pytest.raises(DataError, match="M3 fixture triage"):
        audit_independent_fixture_candidates(
            p, (replace(r[0], **change), *r[1:]), links
        )


def test_non_bijective_club_link_cannot_be_inferred_from_scores(corpus):
    p, r, links = corpus
    with pytest.raises(DataError, match="non-bijective"):
        audit_independent_fixture_candidates(
            p, r, (replace(links[0], independent_club=links[1].independent_club),
                   *links[1:])
        )


def test_duplicate_private_id_or_reference_id_is_rejected(corpus):
    p, r, links = corpus
    with pytest.raises(DataError, match="duplicate private"):
        audit_independent_fixture_candidates((p[0], p[0], *p[2:]), r, links)
    with pytest.raises(DataError, match="repeated reference"):
        audit_independent_fixture_candidates(
            p, (r[0], replace(r[1], reference_id=r[0].reference_id), *r[2:]), links
        )


def test_reject_non_tuple_mutable_and_empty_private_envelopes(corpus):
    p, r, links = corpus
    for args in ((list(p), r, links), (p, list(r), links),
                 (p, r, list(links)), ((), r, links)):
        with pytest.raises(DataError):
            audit_independent_fixture_candidates(*args)
