# M3-A3: six 2023/24 RFS score-shape confirmations and dated pre-match notices

**Observed 2026-11-10 · M3-A3 OPEN; M3 2/8.** Related to [#271](https://github.com/StanleyLl0yd/FootballForecast/issues/271) and [previous mask-127 receipt](M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_REPRODUCTION_2026-11-10.md). See [public-safe JSON receipt](M3_SIX_OFFICIAL_SCORE_SHAPE_EVIDENCE.json).

## Source qualification

The [retrospective RFS 2023/24 calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568) displays *official results*, home/away direction and scheduled Moscow-local times for the **same six already anchored events**. We independently checked these public scores; they are **not private scores**. Importantly, an official result can differ from actually played goals following disciplinary revisions.

Four **date-stamped first-party RFS referee-announcement pages**, each bearing a date before the relevant fixture, independently document the intended participants and date before play:

- [14 September 2023 RFS notice](https://www.rfs.ru/news/218948) names **Dynamo–Pari NN** on Sep 15, **Spartak–Sochi** on Sep 16 and **Rubin–Zenit** on Sep 17.
- [6 October 2023 RFS notice](https://www.rfs.ru/news/219089) names **Sochi–Zenit** on Oct 7.
- [3 November 2023 RFS notice](https://www.rfs.ru/news/219310) names **Sochi–Dynamo** on Nov 6.
- [12 April 2024 RFS notice](https://www.rfs.ru/news/220209) names **Sochi–Spartak** on Apr 13.

**Crucial chronology limit:** displayed web-page dates are **not archived evidence of the original first publication instant**, and these referee pages **do not establish originally published exact kickoff times**. Neither current RFS HTML nor the retrospective fixture schedule authenticates actual match kickoff to the minute. These sources remain *manual first-party references*, not a license for bulk training on RFS website content.

## Six public score observations

| Code | Official fixture and date | Retrospective RFS official score | RFS pre-match announcement date | Anonymous private match shape + exact minute + official goals |
| --- | --- | --- | --- | --- |
| `spartak_sochi_sep16` | Spartak–Sochi, 2023-09-16 | 1:0 | 2023-09-14 | 1 candidate, 1 score agreement |
| `sochi_spartak_apr13` | Sochi–Spartak, 2024-04-13 | 1:0 | 2024-04-12 | 1 candidate, 1 score agreement |
| `sochi_zenit_oct07` | Sochi–Zenit, 2023-10-07 | 0:2 | 2023-10-06 | 1 candidate, 1 score agreement |
| `rubin_zenit_sep17` | Rubin–Zenit, 2023-09-17 | 0:3 | 2023-09-14 | 1 candidate, 1 score agreement |
| `sochi_dinamo_nov06` | Sochi–Dynamo Moscow, 2023-11-06 | 3:3 | 2023-11-03 | 1 candidate, 1 score agreement |
| `dinamo_pari_sep15` | Dynamo Moscow–Pari NN, 2023-09-15 | 1:1 | 2023-09-14 | 1 candidate, 1 score agreement |

Six private candidates had already been uniquely matched by **season mask, directed pair and exact provider-stored UTC minute**. This study adds comparisons to the **six publicly reported official scorelines**. The SQL reads private goal columns *only inside PostgreSQL*, returning aggregate **counts, not match/club IDs, source records or individual private scores**. These six were checked against one 2023/24 snapshot; no other season and no 2025/26 data were queried.

Actual SELECT-only result:
```text
expected_events=6
anonymous_exact_minute_matches=6
official_score_agreements=6
official_score_disagreements=0
nonunique_event_count=0
events_found=6
missing_events=0
season_snapshot_count=1
```

## Reproduction (authorized read-only connection only)

The full query below was executed using a single **SELECT**; no temporary tables, functions, migrations or writes. It does not emit private identifiers/rows.

```sql
WITH years(season,bit) AS (
 VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
 ('2022/23',16),('2023/24',32),('2024/25',64)
), members AS (
 SELECT DISTINCT s.season,m.home_team_id AS club
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN years y ON y.season=s.season
 UNION
 SELECT DISTINCT s.season,m.away_team_id AS club
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN years y ON y.season=s.season
), masks AS (
 SELECT members.club,SUM(years.bit)::int mask
 FROM members JOIN years ON members.season=years.season GROUP BY members.club
), events(code,stamp,hm,am,hg,ag) AS (
 VALUES
 ('spartak_sochi_sep16',timestamptz '2023-09-16 16:00:00+00',127,62,1,0),
 ('sochi_spartak_apr13',timestamptz '2024-04-13 11:00:00+00',62,127,1,0),
 ('sochi_zenit_oct07',timestamptz '2023-10-07 11:00:00+00',62,127,0,2),
 ('rubin_zenit_sep17',timestamptz '2023-09-17 13:30:00+00',111,127,0,3),
 ('sochi_dinamo_nov06',timestamptz '2023-11-06 16:30:00+00',62,127,3,3),
 ('dinamo_pari_sep15',timestamptz '2023-09-15 16:00:00+00',127,120,1,1)
), matched AS (
 SELECT e.code,m.home_goals=e.hg AND m.away_goals=e.ag AS score_agrees
 FROM events e
 JOIN ff_private.ff_rpl_history_snapshots s ON s.season='2023/24'
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id AND m.kickoff_at=e.stamp
 JOIN masks mh ON mh.club=m.home_team_id AND mh.mask=e.hm
 JOIN masks ma ON ma.club=m.away_team_id AND ma.mask=e.am
)
SELECT 
 (SELECT count(*)::int FROM events) expected_events,
 (SELECT count(*)::int FROM matched) anonymous_exact_minute_matches,
 (SELECT count(*)::int FROM matched WHERE score_agrees) official_score_agreements,
 (SELECT count(*)::int FROM matched WHERE NOT score_agrees) official_score_disagreements,
 (SELECT count(*)::int FROM (SELECT code FROM matched GROUP BY code HAVING count(*)<>1) v) nonunique_event_count,
 (SELECT count(DISTINCT code)::int FROM matched) events_found,
 (SELECT count(*)::int FROM (SELECT code FROM events EXCEPT SELECT code FROM matched) miss) missing_events,
 (SELECT count(*)::int FROM ff_private.ff_rpl_history_snapshots WHERE season='2023/24') season_snapshot_count;
```

The pure `ml/src/football_forecast/research/m3_official_score_correspondence.py` validator only checks a pinned, public-safe receipt and its previous anchor invariants; it does **not** query or certify actual SQL execution. Negative tests reject changed public goals, notice dates, aggregate numbers, leakage flags or prior A3 denial status.

## Not established (hard stop)

- **No independently certified played-goal labels**: six matches' final RFS official scores agree with the private retrospective provider's score shape, but this does not independently confirm on-field score/administrative version for every fixture.
- **No historically authenticated UTC kickoff or first-serving time**: exact-minute agreement means two records agree, not that either is independently authentic.
- **No independently approved source-specific legal club identity map** despite anonymous structural consistency.
- **No original provider/syndicated-feed training-rights clearance** and no verified season-wide coverage.
- **No real A4/A5 model training/evaluation**, no permission to use 2025/26, no M2 escrow/RLS changes, no public forecasts.

**A3 remains OPEN, certified eligible private rows remain 0 (meaning unverified, not nonexistent), M3 2/8.** Next: independent played/technical/revision proof per private fixture, original source first-serving and competition/provider rights; only then a reviewed per-season eligible denominator.
