# M3-A3: official fixture anchors for three anonymous mask-127 clubs

**2026-11-10. Read-only retrospective evidence. A3 OPEN; M3 2/8.**

The prior [nine-official-minute receipt](M3_NINE_OFFICIAL_UTC_MINUTE_REPRODUCTION_2026-11-10.md) matched nine FC Sochi fixtures without exporting a private provider ID or result. The seven-season participation mask **127** is shared by several clubs, so this mask alone could not differentiate the Spartak, Zenit and Dynamo Moscow counterpart candidates.

The [RFS retrospective official 2023/24 calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568) provides two more public scheduling anchors:

- **Rubin–Zenit**, 2023-09-17 at 16:30 Moscow / **13:30 UTC**; public seven-season masks **111/127**.
- **Dynamo Moscow–Pari NN**, 2023-09-15 at 19:00 Moscow / **16:00 UTC**; masks **127/120**.

Alongside the previously corroborated two reciprocal Spartak–Sochi events, Sochi–Zenit and Sochi–Dynamo, this distinguishes a *six-event anonymous subgraph*. A retrospective calendar is not a historic first-serving timestamp or a verified actual played kickoff.

## Live read-only evidence (PostgreSQL 17)

Two SELECT-only aggregate queries against the existing seven 2018/19–2024/25 private snapshots built anonymous participation masks **inside PostgreSQL**, and returned only counts. Private IDs were used for grouping and COUNT(DISTINCT) internally, never returned. Neither query selected scores, match identifiers, private names, feature rows, the consumed 2025/26 holdout, or model artifacts.

| Public event | Scheduled UTC | Same-day private matches | Same-day mask + direction | Exact-minute candidates |
| --- | --- | ---: | ---: | ---: |
| Spartak–Sochi | 2023-09-16 16:00Z | 4 | 1 | 1 |
| Sochi–Spartak | 2024-04-13 11:00Z | 4 | 1 | 1 |
| Sochi–Zenit | 2023-10-07 11:00Z | 4 | 1 | 1 |
| Rubin–Zenit | 2023-09-17 13:30Z | 3 | 1 | 1 |
| Sochi–Dynamo Moscow | 2023-11-06 16:30Z | 3 | 1 | 1 |
| Dynamo Moscow–Pari NN | 2023-09-15 16:00Z | 1 | 1 | 1 |

Across these events: **six unique exact-minute rows; zero ambiguous events; all three public-club pairs each reuse one anonymous provider ID; the three pair IDs are distinct; all four Sochi-related events refer to one anonymous Sochi ID**. These are relational structural observations, not an approved private-ID-to-club mapping.

## Reproduction: anonymous SQL, no identifier or score output

The six-event equality query used (run only with authorized read-only access):

~~~sql
WITH years(season,bit) AS (
 VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
 ('2022/23',16),('2023/24',32),('2024/25',64)
), member AS (
 SELECT DISTINCT s.season,m.home_team_id club
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN years y ON y.season=s.season
 UNION
 SELECT DISTINCT s.season,m.away_team_id club
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN years y ON y.season=s.season
), masks AS (
 SELECT member.club,SUM(years.bit)::int mask
 FROM member JOIN years ON member.season=years.season GROUP BY member.club
), events(code,club,stamp,hm,am,role,sochirole) AS (
 VALUES
 ('spartak_sochi_sep16','spartak',timestamptz '2023-09-16 16:00:00+00',127,62,'home','away'),
 ('sochi_spartak_apr13','spartak',timestamptz '2024-04-13 11:00:00+00',62,127,'away','home'),
 ('sochi_zenit_oct07','zenit',timestamptz '2023-10-07 11:00:00+00',62,127,'away','home'),
 ('rubin_zenit_sep17','zenit',timestamptz '2023-09-17 13:30:00+00',111,127,'away',NULL),
 ('sochi_dinamo_nov06','dinamo_moscow',timestamptz '2023-11-06 16:30:00+00',62,127,'away','home'),
 ('dinamo_pari_sep15','dinamo_moscow',timestamptz '2023-09-15 16:00:00+00',127,120,'home',NULL)
), candidates AS (
 SELECT e.code,e.club,e.sochirole,
 CASE WHEN e.role='home' THEN m.home_team_id ELSE m.away_team_id END clubid,
 CASE WHEN e.sochirole='home' THEN m.home_team_id
      WHEN e.sochirole='away' THEN m.away_team_id END sochiid
 FROM events e JOIN ff_private.ff_rpl_history_snapshots s ON s.season='2023/24'
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id AND m.kickoff_at=e.stamp
 JOIN masks mh ON mh.club=m.home_team_id AND mh.mask=e.hm
 JOIN masks ma ON ma.club=m.away_team_id AND ma.mask=e.am
)
SELECT
 (SELECT COUNT(*) FROM candidates)::int exact_candidate_rows,
 (SELECT COUNT(DISTINCT code) FROM candidates)::int event_count,
 (SELECT COUNT(*) FROM (SELECT code FROM candidates GROUP BY code HAVING COUNT(*)<>1) v)::int nonunique_event_count,
 (SELECT COUNT(*) FROM (SELECT club FROM candidates GROUP BY club
   HAVING COUNT(*)=2 AND COUNT(DISTINCT clubid)=1) v)::int uniquely_linked_clubs,
 (SELECT COUNT(DISTINCT clubid) FROM candidates)::int distinct_candidate_club_ids,
 (SELECT COUNT(DISTINCT sochiid) FROM candidates WHERE sochirole IS NOT NULL)::int distinct_sochi_ids,
 (SELECT jsonb_object_agg(code,n) FROM
   (SELECT code,COUNT(*)::int n FROM candidates GROUP BY code) v)::jsonb event_candidate_counts;
~~~

The separate day-level SELECT used the same participation-mask CTE and events, but LEFT JOINed 2023/24 private matches by their UTC date instead of their exact minute. It counted all games on each day, then the subset whose home/away masks and direction matched, and finally exact UTC-minute matches. Its public-safe output is shown in the table.

## Locked interpretation and acceptance

The [aggregate JSON evidence](M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_EVIDENCE.json) is checked by the pure audit module
ml/src/football_forecast/research/m3_mask127_anchor_graph.py and 34 focused negative/positive tests. The module requires every expected public event, its Moscow-to-UTC conversion, mask/direction/count, official calendar URL, unchanged four overlapping prior nine-event facts, and explicit privacy/eligibility-denial flags. No private ID or score is a permitted evidence field.

This **does not** prove the actual on-field kickoff, original publication or provider first-serving timestamp, played-versus-awarded-versus-revised goal truth, authenticated legal club continuity, or a complete cross-season source-specific ID crosswalk. Source training rights are not established by this calendar. **Certified eligible private rows remain 0 (unverified, not proof that no matches were played)**. The 2025/26 holdout is still consumed and off-limits. No private source mutation, RLS change, model training, escrow operation, public forecast or production deployment is authorized by this receipt.

**Next:** independently verify remaining clubs and match statuses, then review a private per-fixture eligibility crosswalk and original timestamps. A3, real A4 and A5 remain blocked.
