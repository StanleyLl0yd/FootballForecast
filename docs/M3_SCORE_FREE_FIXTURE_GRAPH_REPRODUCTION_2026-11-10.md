# M3-A3 · Score-free public/private correspondence of 1,200 retrospective fixtures

**Observed 2026-11-10. Research-only, SELECT-only, no private ID or match export. A3 OPEN, M3 2/8.**

[Aggregate JSON receipt](M3_SCORE_FREE_FIXTURE_GRAPH_EVIDENCE.json) · [prior five-season date+score frequency comparison](M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_REPRODUCTION_2026-11-10.md) · [seven-season public roster evidence](M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json) · [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271)

## Result: fixture correspondence selected without looking at score

The five previously pinned publisher-declared CC0 historical files (2018/19, 2019/20, 2020/21, 2023/24 and 2024/25; 240 public fixtures each) were **read from immutable Git blobs in memory**. All 1,200 public rows were translated to:

`public_event_id, season, public_date, public_home_alias, public_away_alias, seven_season_home_mask, seven_season_away_mask, public_score`.

A separately computed private seven-season anonymous mask was formed **inside PostgreSQL 17**. Candidate private fixture edges were joined on **season + UTC calendar date of provider-stored kickoff + direction-specific home/away masks**. **Goals were not used at any stage of candidate-edge creation or club alias-map inference.** The existing one-public-event direction error in 2023/24 was simulated in memory from independent Sochi club and RFS references, not applied to either stored source.

The first stage required *reciprocal uniqueness*: exactly one private candidate for a public event and exactly one public event for that private match. These 1,063 seed fixtures supplied public alias ↔ opaque private-ID equality pairs **only within the SQL transaction**. A deterministic group-by then checked public aliases mapping to multiple private IDs and private IDs mapping to multiple public aliases: **both conflicting-group counts were zero**, across **25 public aliases represented in these five sources**.

The resulting internally consistent alias graph filtered the other 137 initially ambiguous public fixture candidates. This gave exactly one reciprocal match for all 1,200 public and 1,200 private provider-finished records. **Only after that independent-of-score matching** did a private SQL aggregate compare public final-score pairs with private provider results; **zero discrepancies** were counted. No per-fixture private scores, IDs, mapping table, result bins, or source rows left PostgreSQL.

| Season | Public / private rows | Unique from date, side and masks | Initially ambiguous | Resolved after cross-season alias consistency | Final score differences |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2018/19 | 240 / 240 | 209 | 31 | 240 | 0 |
| 2019/20 | 240 / 240 | 219 | 21 | 240 | 0 |
| 2020/21 | 240 / 240 | 202 | 38 | 240 | 0 |
| 2023/24 | 240 / 240 | 217 | 23 | 240 | 0 |
| 2024/25 | 240 / 240 | 216 | 24 | 240 | 0 |
| **Total** | **1,200 / 1,200** | **1,063** | **137** | **1,200** | **0** |

This is stronger than the previous result-only date histogram: club cross-season consistency resolves cases where multiple matches have the same membership profile and date, **before** using the provider's result. It is still **retrospective structural corroboration**, not independent authentication of provider IDs, source rights or actual played-goal history.

## Source input constraints and replay

The **only** fixture inputs are the five immutable publicly pinned files in [the prior audit](M3_FIVE_SEASON_DATE_SCORE_HISTOGRAM_EVIDENCE.json). Public result records were transient; not committed to Git, copied into the private archive or published as a club-ID map.

- JSON: exactly 240 rows; `matches[].date`, `team1`, `team2`, `score.ft`. No venue time assumed.
- Football.TXT: exactly 240 `Team A v Team B H-A` rows; parse the file's dated heading with explicit year where present and inferred season year for later headings. Blank public kick-off times are **not** imputed.
- Public club aliases are exact-normalized against [the existing seven RSSSF roster aliases](M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json). Deterministic conversion is: `Zenit St. Petersburg→zenit`, `Spartak Moskva→spartak`, `Dinamo Moskva→dinamo_moscow`, `Lokomotiv Moskva→lokomotiv`, `CSKA Moskva→cska`, `FK Krasnodar→krasnodar`, `FK Rostov→rostov`, `Akhmat Grozny→akhmat`, `Rubin Kazan→rubin`, `FK Orenburg→orenburg`, `FK Ural→ural`, `Krylia Sovetov→krylia`, `Arsenal Tula→arsenal_tula`, `FK Ufa→ufa`, `Anzhi Makhachkala→anji`, `Enisey Krasnoyarsk→enisey`, `FK Sochi→sochi`, `FK Tambov→tambov`, `FK Khimki→khimki`, `Rotor Volgograd→rotor`, `Baltika Kaliningrad→baltika`, `FK Nizhny Novgorod→nizhny_novgorod`, `Fakel Voronezh→fakel`, `Akron Tolyatti→akron`, `FK Dinamo Makhachkala→dinamo_makhachkala`. Unexpected names cause refusal; two absent development-year paths remain absent.
- Use all **seven** already-reviewed public roster seasons to compute club membership mask as 1, 2, 4, 8, 16, 32, 64 for 2018/19 through 2024/25. This is a consistency mask, not legal club-identity proof.
- The pinned 2023/24 Football.TXT **line 113** public source entry `FK Sochi v Spartak Moskva 0-1` on 2023-09-16 is reversed **only in the ephemeral public input**, to official `Spartak v Sochi 1-0` as documented by [the Sochi club's venue agreement](https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/) and [RFS retrospective calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568). Zero edits to public blob or private source.

### Bounded SQL computation

This is a reproducible **template**. The replay must build the **public-only** 1,200-row `VALUES` from the above pinned blobs; those rows are deliberately **not committed**, to avoid posting mass source material or any private match rows. Never return `source_match_id` or `home_team_id` / `away_team_id`. Read permissions must be owner-authorized, SELECT-only and restricted to seven development seasons.

```sql
WITH years(season,bit) AS (
  VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
         ('2022/23',16),('2023/24',32),('2024/25',64)
),
members AS (
  SELECT DISTINCT s.season,m.home_team_id opaque_id
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN years y ON y.season=s.season
  UNION
  SELECT DISTINCT s.season,m.away_team_id opaque_id
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN years y ON y.season=s.season
),
mask AS (
  SELECT members.opaque_id,SUM(y.bit)::int membership_mask
  FROM members JOIN years y ON members.season=y.season GROUP BY members.opaque_id
),
p(eid,season,dt,home_alias,away_alias,home_mask,away_mask,hg,ag) AS (
  VALUES
    -- GENERATED IN MEMORY: exactly 1200 public-only row literals
),
v AS (
  SELECT s.season,m.source_match_id opaque_mid,
         m.home_team_id opaque_home,m.away_team_id opaque_away,
         (m.kickoff_at AT TIME ZONE 'UTC')::date dt,
         m.home_goals hg,m.away_goals ag,
         mh.membership_mask home_mask,ma.membership_mask away_mask
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN mask mh ON mh.opaque_id=m.home_team_id
  JOIN mask ma ON ma.opaque_id=m.away_team_id
  WHERE s.season IN ('2018/19','2019/20','2020/21','2023/24','2024/25')
),
edges AS (
  SELECT p.*,v.opaque_mid,v.opaque_home,v.opaque_away,
         v.hg private_hg,v.ag private_ag
  FROM p JOIN v ON p.season=v.season AND p.dt=v.dt
    AND p.home_mask=v.home_mask AND p.away_mask=v.away_mask
    -- CRITICAL: NO GOAL COLUMNS IN THE JOIN CONDITION
),
pub_degree AS (
  SELECT p.eid,COUNT(e.opaque_mid)::int n
  FROM p LEFT JOIN edges e ON e.eid=p.eid GROUP BY p.eid
),
private_degree AS (
  SELECT v.season,v.opaque_mid,COUNT(e.eid)::int n
  FROM v LEFT JOIN edges e ON e.season=v.season
                            AND e.opaque_mid=v.opaque_mid
  GROUP BY v.season,v.opaque_mid
),
seeds AS (
  SELECT e.* FROM edges e
  JOIN pub_degree pd ON pd.eid=e.eid AND pd.n=1
  JOIN private_degree vd ON vd.season=e.season
      AND vd.opaque_mid=e.opaque_mid AND vd.n=1
),
links AS (
  SELECT home_alias public_alias,opaque_home opaque_id FROM seeds
  UNION ALL
  SELECT away_alias public_alias,opaque_away opaque_id FROM seeds
),
alias_map AS (
  SELECT public_alias,MIN(opaque_id) opaque_id
  FROM links GROUP BY public_alias
  HAVING COUNT(DISTINCT opaque_id)=1
),
resolved AS (
  SELECT e.* FROM edges e
  JOIN alias_map h ON h.public_alias=e.home_alias
                  AND h.opaque_id=e.opaque_home
  JOIN alias_map a ON a.public_alias=e.away_alias
                  AND a.opaque_id=e.opaque_away
)
SELECT
  COUNT(*)::int resolved_edges,
  COUNT(*) FILTER (WHERE hg<>private_hg OR ag<>private_ag)::int
    score_disagreement_edges
FROM resolved;
-- In the actual read-only query, additionally output ONLY per-season
-- public/private counts, seed/ambiguous counts, reciprocal resolved
-- degrees, count of conflicting alias mappings and count of missing rows.
-- No individual private values or identities are output.
```

In the actual query, public and private row degrees were both checked: **all exactly 1 after alias-graph filtering**. Public alias consistency and private-ID-to-alias consistency were checked as distinct internal group cardinalities. The pure [validator](../ml/src/football_forecast/research/m3_score_free_fixture_graph.py) and [negative tests](../ml/tests/test_m3_score_free_fixture_graph.py) verify the aggregate receipt's pins and denial flags, **not** the live SQL execution or source completeness.

## What this does *not* establish

1. **Not independently attested legal club continuity.** The 25 mappings are **inferred internal structural equalities** from the same schedule graph and retrospective provider archive. They are never exported or considered an approved source-specific ID crosswalk. Some sources may share an upstream feed.
2. **Not 1,200 on-field score labels.** In particular, at least six known public technical awards in 2019/20 and 2020/21 have 3:0/0:3 official results without played goals. 2022/23's separately documented RFS 1:1 on-field, later official 0:3 revision is in one of the **two absent CC0 paths** and remains unresolved for private played-goal use.
3. **Not authentic original event times.** The private provider's present UTC calendar day can agree with a later public schedule without proving actual kickoff UTC or original first-serving UTC. All source-publication attestation counts remain zero.
4. **Not independently licensed seven-season training.** CC0 is a public repository's declaration; upstream private provider's current RPL source names an unlicensed supplier. Rights for derivative ML model use and original historical result chronology remain unproven.
5. **Not A3 acceptance or any real model fitting/evaluation.** Five of seven development seasons covered; there is no verified eligible-row denominator, calibration, strict as-of feature cohort, source-rights decision, M2 escrow change or 2025/26 re-use.

**M3 A3 remains OPEN, accepted 2/8; independently certified private training examples = 0 (unverified, not a claim that no football was played).** Next: qualify 2021/22 and 2022/23 independently and resolve per-fixture technical/revised statuses, original serving timestamps and training rights before treating any rows as eligible.
