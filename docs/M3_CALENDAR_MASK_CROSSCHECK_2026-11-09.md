# M3-A3 · Calendar-day and seven-year identity-mask candidates (NOT VERIFIED IDENTITY)

**2026-11-09.** This is a development-only **SELECT-only** comparison, no private row/ID export, no goal, score or status fields read. The canonical output is [an eight-event aggregate receipt](M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json). It extends [the full mask-histogram comparison](M3_MEMBERSHIP_SIGNATURE_AUDIT_2026-11-09.md). M3 remains **2/8 OPEN**, real fitting and 2025/26 holdout access prohibited.

## What was compared

For eight previously documented public calendar events, an independent seven-year **public club participation mask** was matched *inside Postgres* to a private club-ID mask computed by seven-season set membership. Only the number of matches on a **private UTC calendar day**, the number whose team mask appeared in the documented role, and for the two swap events the number facing **an eight-season-member profile** (all seven development seasons) were returned.

| Public event | Public singleton alias / mask | Private day match count | Matching role+mask records | All-seven-profile opponent candidates |
| --- | --- | ---: | ---: | ---: |
| Orenburg, 2020-06-27 | orenburg / 115 (home) | 5 | 1 | — |
| Orenburg, 2020-07-01 | orenburg / 115 (home) | 6 | 1 | — |
| Sochi, 2020-07-16 | sochi / 62 (away) | 4 | 1 | — |
| Sochi, 2020-07-22 | sochi / 62 (away) | 8 | 1 | — |
| Rotor, 2020-09-13 | rotor / 4 (home) | 3 | 1 | — |
| Rotor, 2020-09-19 | rotor / 4 (away) | 2 | 1 | — |
| Sochi–Spartak public fixture, 2023-09-16 | sochi / 62 (either) | 4 | 1 | 1 |
| Sochi–Spartak public fixture, 2024-04-13 | sochi / 62 (either) | 4 | 1 | 1 |

The masks `115`, `62`, `4` are public-singleton *participation patterns*, not certified official club identities for any private provider ID. In particular `127` is **shared by eight clubs**, and the opponent at the two Sochi calendar dates **is not independently identified as Spartak** by this check. Public local calendar dates have **not** been independently reconciled with original first-source UTC clocks. There is no private match-to-public match proof or certification that either source correctly identifies played/technical match status. Nothing is automatically quarantined, corrected or added to any real training cohort.

## SQL shape and confidentiality

The query used the same exact seven-year `seasons`, `memberships`, `masks` CTE from [the membership receipt](M3_MEMBERSHIP_SIGNATURE_AUDIT_2026-11-09.md), with a constant **eight-row VALUES event table** containing public season, public date, public singleton seven-year mask and expected side (`home`, `away`, `either`). Joining the archived `kickoff_at AT TIME ZONE 'UTC'` **calendar date only** yielded the per-event COUNT filters and no identifiers, names, timestamps, scorelines, credentials or match-level records. The exact read-only SQL is recorded here as reproducible pseudocode using the existing CTE definitions:

```sql
BEGIN READ ONLY;
WITH seasons(season,bit) AS (
 VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
        ('2022/23',16),('2023/24',32),('2024/25',64)
), memberships AS (
 SELECT DISTINCT s.season,m.home_team_id AS club_id
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN seasons o ON o.season=s.season
 UNION
 SELECT DISTINCT s.season,m.away_team_id AS club_id
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN seasons o ON o.season=s.season
), masks AS (
 SELECT m.club_id,SUM(o.bit)::int AS mask
 FROM memberships m JOIN seasons o ON o.season=m.season
 GROUP BY m.club_id
), public_events(event,season,day_utc,subject_mask,side) AS (
 VALUES ('orenburg_a','2019/20',DATE '2020-06-27',115,'home'),
        ('orenburg_b','2019/20',DATE '2020-07-01',115,'home'),
        ('sochi_a','2019/20',DATE '2020-07-16',62,'away'),
        ('sochi_b','2019/20',DATE '2020-07-22',62,'away'),
        ('rotor_a','2020/21',DATE '2020-09-13',4,'home'),
        ('rotor_b','2020/21',DATE '2020-09-19',4,'away'),
        ('sochi_spartak_a','2023/24',DATE '2023-09-16',62,'either'),
        ('sochi_spartak_b','2023/24',DATE '2024-04-13',62,'either')
), candidates AS (
 SELECT e.event,mh.mask AS home_mask,ma.mask AS away_mask
 FROM public_events e
 JOIN ff_private.ff_rpl_history_snapshots s ON s.season=e.season
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
  AND (m.kickoff_at AT TIME ZONE 'UTC')::date=e.day_utc
 JOIN masks mh ON mh.club_id=m.home_team_id
 JOIN masks ma ON ma.club_id=m.away_team_id
)
SELECT e.event,COUNT(c.event)::int AS day_count,
 COUNT(c.event) FILTER(WHERE
   (e.side='home' AND c.home_mask=e.subject_mask) OR
   (e.side='away' AND c.away_mask=e.subject_mask) OR
   (e.side='either' AND (c.home_mask=e.subject_mask OR c.away_mask=e.subject_mask))
 )::int AS matching_role_mask,
 COUNT(c.event) FILTER(WHERE e.side='either' AND
  ((c.home_mask=62 AND c.away_mask=127) OR
   (c.away_mask=62 AND c.home_mask=127))
 )::int AS all_seven_profile_opponent_candidate
FROM public_events e LEFT JOIN candidates c ON c.event=e.event
GROUP BY e.event ORDER BY e.event;
COMMIT;
```

## Owner-only display and invariants

The owner GUI shows only these **aggregate verification counts** when public-safe JSON, complete histogram hash, all eight event assertions and prior source-day totals agree. A corrupted/contradictory receipt hides the statistics. No production API endpoint, schema/grant, model training job or secret is added. Original public references for the technical awards and Sochi–Spartak venue changes remain documented in [M2 independent anomalies](M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json). Current evidence is **retrospective source correspondence, not official team-ID mapping or historical pre-match evidence**. A3 remains open.
