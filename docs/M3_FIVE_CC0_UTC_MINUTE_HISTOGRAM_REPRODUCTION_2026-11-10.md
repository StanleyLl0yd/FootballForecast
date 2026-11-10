# M3-A3 · Public Moscow-clock vs private UTC-minute aggregate triangulation

**Observed 2026-11-10 · M3 OPEN 2/8, A3 unaccepted.**
[Aggregate evidence](M3_FIVE_CC0_UTC_MINUTE_HISTOGRAM_EVIDENCE.json) · [Pinned public source inventory](M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json) · [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271).

## Purpose and qualification

Five existing, immutable publisher-declared CC0 RPL source blobs contain scheduled/reported match dates and, for some records, local clock times. The source format **does not independently authenticate its original timezone**, actual on-field kickoffs or *when these values were first made publicly available*. We tested a **Moscow-local (Europe/Moscow, UTC+03 during 2018–2025) interpretation**, then compared only *distributions* of public converted UTC minute stamps with private provider historical kickoff stamps.

The public conversion was done in memory; PostgreSQL grouped private timestamps inside one authorized **SELECT-only** query, returning only season-level aggregates. **No private timestamp bucket counts, match names/IDs, rows, scores or model data were returned.** A source missing a time kept a null clock; no artificial 00:00 value was added.

## Results

| Season | Public fixtures | With explicit clock | No clock | Distinct public UTC minutes | Exact-minute histogram overlap | Public-clock observations not overlapping | L1 minute difference |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2018/19 | 240 | 240 | 0 | 229 | **221** | 19 | 38 |
| 2019/20 | 240 | 238 | 2 | 212 | **221** | 17 | 36 |
| 2020/21 | 240 | 238 | 2 | 197 | **237** | 1 | 4 |
| 2023/24 | 240 | 221 | 19 | 221 | **221** | 0 | 19 |
| 2024/25 | 240 | 216 | 24 | 216 | **216** | 0 | 24 |
| **Total** | **1,200** | **1,153** | **47** | — | **1,116** | **37** | **121** |

The 1,116 overlaps count a minimum of public/provider minute-bucket pairs in each season, **not** 1,116 certified cross-provider fixture matches. The remaining 84 private rows have no corresponding public explicit-minute overlap, either because of 47 missing public clocks or different time records. This is not proof that private kickoffs are wrong.

The strongest structural cases are 2023/24 (221/221 public explicit clocks coincide) and 2024/25 (216/216), using the stated Moscow UTC conversion; the other seasons contain mismatches requiring independent time and fixture investigation. Such perfect aggregate agreement may also reflect shared upstream data and cannot prove independence, clock correctness or historical pregame availability.

## Reproduction method and scope

The five public Git blob SHAs are pinned in the JSON receipt. Each can be loaded into the **pure, no-I/O** parser football_forecast.research.m3_cc0_utc_minute_histogram.public_utc_minute_histogram(raw_text, format, season). JSON files have direct date/time fields. The Football.TXT files have date headers (explicit year when present; otherwise month July–December maps to season start year and January–June to the next year) and optional inline HH:MM; missing clocks are **not filled**.

The parser interprets times with Python zoneinfo Europe/Moscow and converts to aware UTC minute datetimes. It returns a public-only Counter, total matches, clocked and missing records. In this narrow historical window the assumed offset is UTC+3; **the interpretation is a hypothesis**, not authenticated primary source documentation. No post-match target-game time information is fed to a pre-match model.

Generate a SQL PUBLIC-only VALUES table with (season, utc_minute, public_count) for every distinct clocked UTC minute. An authorized read-only database then groups matching *private* counts and reports only the aggregates. Example SQL shape:

~~~sql
-- Reproduction template; fill the public VALUES from the pinned
-- source-only parser. Do NOT emit private individual timestamps.
WITH public(season,utc_minute,n) AS (
  VALUES
  -- ('2018/19', timestamptz '2018-07-28 13:30Z', public_n), ...
), private AS (
  SELECT s.season,m.kickoff_at AS utc_minute,count(*)::int n
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  WHERE s.season IN ('2018/19','2019/20','2020/21','2023/24','2024/25')
  GROUP BY s.season,m.kickoff_at
), joined AS (
  SELECT coalesce(p.season,q.season) season,
         coalesce(p.n,0) public_n,coalesce(q.n,0) private_n
  FROM public p FULL JOIN private q
    ON p.season=q.season AND p.utc_minute=q.utc_minute
)
SELECT season,sum(public_n)::int public_explicit_clock_rows,
       sum(private_n)::int private_rows,
       sum(least(public_n,private_n))::int exact_minute_overlap,
       sum(abs(public_n-private_n))::int histogram_l1
FROM joined GROUP BY season ORDER BY season;
~~~

Two real SELECT-only operations were performed: the first checked 2018/19, the second 2019/20 and 2020/21 together, the third 2023/24 and 2024/25 together. Each returned only a season-aggregate result. No private bucket values or labels were exported. The original public text and private snapshots were not modified; synthetic tests check the pure parser and denial of invalid dates, unknown season, fabricated clocks, leaked identifiers and claim of authenticated original time.

The JSON validator checks a **public-safe claimed evidence receipt**, not a cryptographic proof of SQL execution or of historical first-serving time. Rows without clocks cannot become exact-minute matches by inventing time values.

## Crucial A3 denial

- Current provider kickoff stamps may be copied from an upstream source; agreement does **not** prove independent actual played kickoffs, venue local time, season chronology or an authentic originally observed UTC instant.
- Private club IDs are not independently named; minute histogram equality does not show that the same clubs played at each coinciding minute.
- The two publicly unavailable CC0 seasons 2021/22 and 2022/23 were not assessed here.
- Six previously documented technical awards remain non-played labels; these time matches do not certify their played status.
- Historical data licensing and initial availability timestamps remain unverified. No real model fitting, evaluation or 2025/26 holdout access is authorized.

**M3 2/8, A3 OPEN; authenticated historical kickoff count certified: 0 (unverified, not nonexistent).** RLS, M2 escrow, public model, sources and the one-use holdout were unchanged.
