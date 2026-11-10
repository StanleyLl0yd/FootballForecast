"""Synthetic RSSSF parser tests: no network and no holdout access."""
from datetime import date

import pytest

from football_forecast.data.contracts import DataError
from football_forecast.research.m3_rsssf_match_schedule import (
    SEASONS,
    audit_rsssf_rpl,
    parse_rsssf_rpl,
)


def _round_robin(teams: tuple[str, ...]) -> list[list[tuple[str, str]]]:
    rotating = list(teams)
    first = []
    for _ in range(15):
        first.append([(rotating[i], rotating[-1-i]) for i in range(8)])
        rotating = [rotating[0], rotating[-1], *rotating[1:-1]]
    return first + [[(away,home) for home,away in games] for games in first]


def synthetic_source(season: str) -> bytes:
    spec=SEASONS[season]
    teams=tuple(sorted(spec["teams"]))
    fixtures=[(ri,home,away) for ri,round_ in
              enumerate(_round_robin(teams),start=1) for home,away in round_]
    goals=[(1,1)]*240
    revised_idx=next((
        i for i,(_,home,away) in enumerate(fixtures)
        if home=="Pari NN" and away=="Torpedo"
    ),None) if season=="2022/23" else None
    if revised_idx is not None:
        goals[revised_idx]=(0,3)
    home_extra,away_extra=spec["goals"]
    home_extra-=sum(h for h,_ in goals)
    away_extra-=sum(a for _,a in goals)
    for i in range(len(goals)):
        if i!=revised_idx and home_extra>0:
            h,a=goals[i]
            goals[i]=(h+1,a)
            home_extra-=1
    for i in range(len(goals)):
        if i!=revised_idx and away_extra>0:
            h,a=goals[i]
            goals[i]=(h,a+1)
            away_extra-=1
    assert home_extra==away_extra==0
    lines=["<html><body><pre>",spec["anchor"],"Final Table:", "Other metadata"]
    for index,(ri,home,away) in enumerate(fixtures):
        if index%8==0:
            is_revised_round=revised_idx is not None and ri==fixtures[revised_idx][0]
            which="Mar 19" if is_revised_round else ("Jul 24" if ri<=15 else "May 21")
            lines.append(f"Round {ri} [{which}. Total Att: 1]")
        h,a=goals[index]
        lines.append(f"  {home:<10} {h}-{a} {away}")
        lines.append("    [Att: 99]")
    lines.append("</pre></body></html>")
    return "\n".join(lines).encode("utf-8")


@pytest.mark.parametrize("season",list(SEASONS))
def test_exactly_240_public_fixtures_and_aggregate_only_receipt(season):
    raw=synthetic_source(season)
    fixtures=parse_rsssf_rpl(raw,season)
    assert len(fixtures)==240
    audit=audit_rsssf_rpl(raw,season)
    assert (audit.fixtures,audit.clubs,audit.directed_pairs,audit.rounds)==(240,16,240,30)
    assert (audit.home_goals,audit.away_goals)==SEASONS[season]["goals"]
    assert audit.revised_official_scores==(season=="2022/23")
    assert sum(n for _,_,n in audit.scoreline_histogram)==240
    assert sum(h*n for h,_,n in audit.scoreline_histogram)==audit.home_goals
    assert sum(a*n for _,a,n in audit.scoreline_histogram)==audit.away_goals
    assert len(audit.source_sha256)==64
    assert len(audit.fixture_graph_sha256)==64
    assert audit==audit_rsssf_rpl(raw,season)
    assert not any(hasattr(audit,k) for k in ("fixtures_by_id","teams_by_id","scores"))


def test_revision_kept_separate_from_2022_on_field_score():
    rows=parse_rsssf_rpl(synthetic_source("2022/23"),"2022/23")
    revised=[x for x in rows if x.official_result_revised]
    assert len(revised)==1
    assert (revised[0].home,revised[0].away)==("Pari NN","Torpedo")
    assert revised[0].day==date(2023,3,19)
    assert (revised[0].home_goals,revised[0].away_goals)==(0,3)


@pytest.mark.parametrize(("old","new"),[
    ("Round 2 [Jul 24.","Round 99 [Jul 24."),
    ("Round 10 [Jul 24.","Round 9 [Jul 24."),
    ("Att: 99","Att: 99"), # reference: same-source harmless comments
])
def test_bad_top_flight_rounds_and_noop_metadata(old,new):
    source=synthetic_source("2021/22").decode()
    if old==new:
        assert parse_rsssf_rpl(source.encode(),"2021/22")
    else:
        with pytest.raises(DataError):
            parse_rsssf_rpl(source.replace(old,new,1).encode(),"2021/22")


def test_missing_score_and_wrong_teams_are_denied():
    source=synthetic_source("2021/22").decode()
    for mutated in (
        source.replace("Ahmat", "Fictional",1),
        source.replace("1-1", "9-9",1),
        source.replace("Round 30 [May 21.", "Round 29 [May 21.",1),
        source.replace("Round 1 [Jul 24.", "Round 1 [Jun 24.",1),
    ):
        if mutated==source:
            continue
        with pytest.raises(DataError):
            parse_rsssf_rpl(mutated.encode(),"2021/22")


def test_rejects_extra_seasons_corrupt_page_and_invalid_bytes():
    raw=synthetic_source("2021/22")
    for season in ("2025/26","2026/27","2018/19"):
        with pytest.raises(DataError):
            parse_rsssf_rpl(raw,season)
    with pytest.raises(DataError):
        parse_rsssf_rpl(raw[:200],"2021/22")
    with pytest.raises(DataError):
        parse_rsssf_rpl(b"\xff"*300,"2021/22")
    with pytest.raises(DataError):
        parse_rsssf_rpl(bytearray(raw),"2021/22")
