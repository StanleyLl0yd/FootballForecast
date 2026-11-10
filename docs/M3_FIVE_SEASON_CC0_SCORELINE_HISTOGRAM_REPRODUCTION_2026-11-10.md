# M3-A3 · Five pinned CC0 scoreline histograms vs private archive

**Observed 2026-11-10 · READ-ONLY SELECT · M3 2/8 OPEN.**
[Public-safe JSON receipt](M3_FIVE_SEASON_CC0_SCORELINE_HISTOGRAM_EVIDENCE.json) · [Prior pinned source inventory](M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json) · [Previously verified public fixture-direction anomaly](M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json).

## What was actually compared

Five existing publisher-declared CC0 historical archives, two repositories (openfootball/football.json and openfootball/europe), yielded exactly 240 published full-time score pairs each. Each was counted in an **in-memory PUBLIC scoreline histogram**. An authorized Supabase **SELECT-only** grouped the private archive's scores internally by season and scoreline, joined against those public histogram counts, and returned only aggregate total rows, histogram L1 differences and number of divergent scoreline bins. Private bucket counts, match rows, scores by match, IDs and source records were not returned.

| Season | Public results | Distinct public scoreline bins | Private provider-finished rows | Histogram L1 | Divergent bins |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2018/19 | 240 | 23 | 240 | **0** | 0 |
| 2019/20 | 240 | 26 | 240 | **0** | 0 |
| 2020/21 | 240 | 28 | 240 | **0** | 0 |
| 2023/24 | 240 | 25 | 240 | **2** | 2 |
| 2024/25 | 240 | 28 | 240 | **0** | 0 |

**Totals: 1,200 public and 1,200 private structural rows, four matching scoreline histograms.** The 2021/22 and 2022/23 pinned public CC0 paths were not found and were not checked here. Six known public unplayed technical awards (four 2019/20, two 2020/21) remain present in those public histograms. A matching total or distribution does **not** prove independent played goals, club identity, original historical timestamps or upstream training rights.

The L1 metric equals the sum of absolute differences in counts by directed (home goals, away goals) bucket. L1=2 is compatible with a single result moving between buckets, but is **not** a confirmed count of incorrectly identified matches.

## Isolating the public 2023/24 home/away error

The pinned 2023/24 public Football.TXT, line 113, incorrectly displays FK Sochi (home)–Spartak Moskva (away), score 0:1, on 2023-09-16. A [dated official Sochi club announcement](https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/) and [independent match report](https://www.championat.com/football/_russiapl/tournament/5441/match/1101821/) support the actual swapped fixture Spartak (home)–Sochi (away) 1:0. The separate 2024 return fixture is Sochi–Spartak 1:0.

A second **SELECT-only** public-histogram *scenario*, swapping this one publicly reported 0:1 bucket entry to 1:0 **in memory only**, produced:

| 2023/24 scenario | Public rows | Private rows | Histogram L1 | Divergent bins |
| --- | ---: | ---: | ---: | ---: |
| Untouched pinned public reference | 240 | 240 | 2 | 2 |
| Hypothetical public-only one-result orientation change | 240 | 240 | **0** | **0** |

The known public error is sufficient to explain the marginal discrepancy. This **does not** prove it is the only possible fixture-level discrepancy, does not certify an individual private match or establish a safe replacement policy. Neither original public blob nor private source was modified.

## Reproduction (bounded, no private bucket disclosure)

The [JSON receipt](M3_FIVE_SEASON_CC0_SCORELINE_HISTOGRAM_EVIDENCE.json) pins the **five exact Git blob IDs**, repository commits, paths and formats. Fetch these immutable public blobs. Call the no-I/O Python function football_forecast.research.m3_cc0_scoreline_histogram.public_scoreline_histogram(raw_text, format), which returns only a Counter of *PUBLIC* scoreline pairs after checking exactly 240 results. It has no network/DB route and is not a data importer.

Convert each PUBLIC-only Counter to SQL VALUES rows (season, home_goals, away_goals, n). Use the following SQL **template**, filling the VALUES with these generated PUBLIC counts. Neither private counts by scoreline nor IDs appear in the SELECT's output.

~~~sql
-- TEMPLATE ONLY: requires the actual public VALUES for all five seasons.
WITH public(season,home_goals,away_goals,n) AS (
  VALUES
  -- PUBLIC (season,home_goals,away_goals,public_bucket_count), ...
), private AS (
  SELECT s.season,m.home_goals,m.away_goals,count(*)::int n
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  WHERE s.season IN ('2018/19','2019/20','2020/21','2023/24','2024/25')
  GROUP BY s.season,m.home_goals,m.away_goals
), joined AS (
  SELECT coalesce(p.season,q.season) AS season,
         coalesce(p.n,0) public_n,coalesce(q.n,0) private_n
  FROM public p FULL JOIN private q
    ON p.season=q.season AND p.home_goals=q.home_goals
   AND p.away_goals=q.away_goals
)
SELECT season,sum(public_n)::int public_rows,
       sum(private_n)::int private_rows,
       sum(abs(public_n-private_n))::int histogram_l1,
       count(*) FILTER(WHERE public_n<>private_n)::int divergent_bins
FROM joined GROUP BY season ORDER BY season;
~~~

The actual first SELECT used all generated public VALUES and returned the five aggregate rows above (signed row-count differences all zero). The second SELECT used a single *public-only* hypothetical 2023/24 result direction change, preserving all original records, and returned the two aggregate scenario rows. Neither query accessed 2025/26.

The pure Python receipt validator and negative tests pin the reported counts, original public source references and explicit denials of training, data export and holdout access. A passing test is **not authentication of the SQL execution or of original source rights**.

## Hard stop

The prior seven-season A3 restrictions remain: independent **per-fixture** home/away and club legal continuity, on-field played-goal versus technical/revised result, authenticated event kickoff and original first-serving UTC, upstream data rights, and final eligible denominator per season. Four equal histograms do not certify 960 eligible rows. Six earlier official-RFS score matches are also only candidates. Real A4/A5 remain blocked. Existing M2 escrow, RLS, one-use 2025/26 study and production predictions unchanged. **A3 OPEN; M3 2/8; independently eligible private rows certified: 0 (unverified).**
