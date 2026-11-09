# M3-A3 · Independent fixture evidence and private source triage (INCOMPLETE)

**9 November 2026**. M3 [issue #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271) remains **2/8**. The M2 2025/26 one-use control is never read, re-evaluated or repurposed. No new model fitting or forecast publication.

## Real read-only database observation

A direct, user-authorized **SELECT-only** inspection was performed against the existing FootballForecast Supabase PostgreSQL 17 database in **eu-central-1**. It accessed **only** `ff_private.ff_rpl_history_snapshots` and `ff_private.ff_rpl_history_matches`. No private match IDs, club identifiers, scores-by-match or credentials were exported in the evidence. The returned aggregates are recorded in [M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json](M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json).

- Each of seven development seasons contains **240 finished-provider rows and 16 teams**, total **1,680**. Each season's original-publication and prematch attestation counts are **zero**. `kickoff_at` fields exist, but observed retrospective provider UTC kickoff values are **not independently authenticated original kickoffs**.
- Both private source tables still have `RLS enabled` and **`FORCE RLS`**; `anon`, `authenticated` and `service_role` have **no SELECT grants**. This is a snapshot of actual database permissions, not a substitute for the existing migration-level regression.
- The dates of **six independently documented unplayed technical results** from a *different public CC0 archive* (2019/20: 2020-06-27, 07-01, 07-16, 07-22; 2020/21: 2020-09-13, 09-19) each have **exactly one** provider-finished private record **with a 3:0 or 0:3 score on the same UTC date**. On those dates the total private match counts are **5, 6, 4, 8, 3, 2** respectively. These are **six strong candidates**, but there is **no private match/club identity crosswalk and no source-local-day-to-UTC-day validation**. Therefore this is **NOT six independently proven private technical results** and does not authorize removing six from 1,680.
- The separate known **2022/23 revised official result** day (2023-03-19) has **4 private fixtures and one 3:0 / 0:3 candidate**. Unlike an unplayed technical award, that independent case involved a match *actually played* whose official result was later changed. The on-field score must be found separately before a played-goal label is accepted.
- The 2023/24 publicly documented home/away source-direction anomaly (2023-09-16) and second venue-swapped meeting (2024-04-13) have **4 private fixtures each** on the relevant UTC dates. This does not yet establish which private row or correct venue.

**No source training eligibility is established by this aggregate inspection.** No private rows or source snapshots were changed.

The read-only season query follows this bounded shape:

```sql
select s.season,
       count(m.*) as provider_finished_rows,
       count(distinct m.home_team_id) as home_clubs,
       count(distinct m.away_team_id) as away_clubs,
       count(*) filter(where m.home_goals=3 and m.away_goals=0) as score_3_0,
       count(*) filter(where m.home_goals=0 and m.away_goals=3) as score_0_3,
       count(*) filter(where m.source_publication_at is not null) as publication_marks,
       count(*) filter(where m.historical_prematch_verified) as prematch_marks
from ff_private.ff_rpl_history_snapshots s
join ff_private.ff_rpl_history_matches m on m.snapshot_id=s.id
where s.season in ('2018/19','2019/20','2020/21','2021/22',
                   '2022/23','2023/24','2024/25')
group by s.season order by s.season;
```

For anomaly-day candidate counts, a nine-row constant `VALUES` date table was left-joined to the private history **using the UTC calendar date** and counted only aggregated scoreline shapes, never row identities. Source evidence still exists separately in [historical CC0 anomaly corroboration](M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json) and [official result revision](M2_PUBLIC_RPL_RESULT_REVISION_EVIDENCE.json).

## Per-fixture cross-provider decision algorithm

`ml/src/football_forecast/research/m3_fixture_correspondence.py` adds a **pure, bounded, unit-tested** comparator for a **future reviewed private runner**. It accepts at most 1,680 development-only provider records and 1,680 public historical references. Team identity is **explicitly declared per season**, unique/bijective, with no fuzzy/score-derived matching and no unverified assumption that club IDs persist across promotion or renaming. Its input is an internal private memory structure, **not a public route**. The independent source namespace and SHA-256 are required but treated as *untrusted assertions*, not verified by this function.

Each private row gets exactly one **mutually exclusive** diagnostic:

| Reason | Meaning | Eligible for real fitting? |
| --- | --- | --- |
| `CANDIDATE_PLAYED_AGREEMENT` | Same declared clubs, directed home/away, UTC date and played score; no conflicting reference row | **NO**, candidate only |
| `IDENTITY_UNMAPPED` | A team lacks declared per-season independent mapping | NO |
| `REFERENCE_MISSING` | No matching independent fixture | NO |
| `REFERENCE_AMBIGUOUS` | Conflicting/duplicated reference fixture | NO |
| `HOME_AWAY_CONFLICT` | Same UTC date but opposing direction | NO |
| `DATE_CONFLICT` | Same directed clubs on different reported UTC days | NO |
| `TECHNICAL_RESULT` | Independent reference declares a technical award | NO |
| `REVISED_OFFICIAL_RESULT` | Official result replaced or annulled; on-field role unresolved | NO |
| `STATUS_UNCLASSIFIED` | Played vs awarded not established | NO |
| `SCORE_UNVERIFIED` | On-field goals missing in reference | NO |
| `SCORE_CONFLICT` | Played score differs from provider final score | NO |

Duplicate private IDs/pairs, impossible scores, missing UTC timezone, sealed year, invalid SHA, same-provider disguised as independent, non-bijective official club map or otherwise invalid source envelope **raise `DataError`** without printing raw rows. The report contains only per-season aggregates and no source records or team names. Even *perfect* synthetic fixture matches yield **zero independently eligible private rows** and **`real_training_authorized=false`**, because signed underlying records, source independence, first-serving history, licensing, trusted club map and source-specific review are not inputs to this pure routine.

The protocol is an engineering guard. Synthetic tests are **not** real-RPL corroboration. This module is **not imported by the public app**, does not read the private database, fetch public sites, fit M2/M3 or write forecasts.

## Remaining mandatory A3 decisions

1. Retrieve and hash bounded **original reference bytes** for the seven development seasons, validate their true origin, rights and role-specific on-field results. The existing independent CC0 snapshots cover five seasons; 2021/22 and 2022/23 require explicitly reviewed alternate evidence.
2. Separately pin a private provider-ID to externally verified legal-club identity crosswalk **for each season**. Official promotion, renaming, stadium transfers, home/away reversals and result revisions must remain independently reviewed, not guessed from a final score or club-name similarity.
3. Implement a distinct **owner-only protected, least-privilege, read-only** row-level correlation job that produces only aggregate counts and evidence SHA (no match IDs or private names in stdout, upload or browser); do not weaken FORCE RLS or introduce a public privileged endpoint.
4. Verify original historical event time and original first-serving source timestamps before claiming any strict as-of. Date-only retrospective agreement remains `NON_STRICT_RETROSPECTIVE`.
5. After independent verification, obtain actual per-season match-classification counts, adjudicate conflicts, lock the development-only candidate protocol, and only then consider real M3 fitting/evaluation.

**A3, A4, A5 and A7 remain open.** The provisional source archive and the consumed 2025/26 holdout have not been altered. The current M3 milestone remains **2/8**.
