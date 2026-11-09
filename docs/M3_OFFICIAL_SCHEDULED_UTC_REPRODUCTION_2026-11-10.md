# M3-A3 · Official scheduled UTC minutes and private masked date candidates

**2026-11-10, read-only reproduction; A3 still OPEN, M3 2/8.**

The official FC Sochi prematch announcements independently state two scheduled
local Moscow times. An owner-authorized SELECT-only PostgreSQL 17 aggregate
query against the existing seven-development-season private history returned
one anonymous candidate for each correct home/away participation-mask
direction at the **exact scheduled UTC minute**. These are scheduled
timestamps, not evidence of the actual played kickoff or original source
first-serving UTC.

| Match (official order) | Publication | Moscow schedule | UTC schedule | UTC-day private count | Direction/mask count | Exact minute count |
| --- | --- | --- | --- | ---: | ---: | ---: |
| Spartak–Sochi, 2023-09-16 | [FC Sochi 2023-09-13](https://pfcsochi.ru/news/2023-2024/informatsiya-dlya-bolelshchikov-o-matche-so-spartakom/) | 19:00 | 16:00Z | 4 | 1 | 1 |
| Sochi–Spartak, 2024-04-13 | [FC Sochi 2024-04-08](https://pfcsochi.ru/news/2023-2024/akkreditatsiya-smi-na-match-so-spartakom/) | 14:00 | 11:00Z | 4 | 1 | 1 |

The second article explicitly says Moscow time. The first describes a match
in Moscow with start 19:00; its interpretation as local Moscow time is
recorded, not an independently proven original publishing clock.
The conversions use Europe/Moscow (UTC+03:00 on these dates).
Publication dates visible today are not authenticated first-serving
UTC timestamps, nor proof that pages have never been edited.

Independent seven-season public roster mask for Sochi is 62 (singleton).
Opposing mask 127 is shared by **eight clubs**, NOT an independently mapped
Spartak private ID. Provider kickoff_at may describe a scheduled time, not
the actual instant the match began. No private rows, private identifiers,
scores, data-source names or match goals were exported. No model was trained,
no database row was modified, and the consumed 2025/26 holdout was not read.
The fixed model, private escrow and FORCE RLS remain unchanged.

## Reproducible SQL (SELECT only, outputs two aggregate rows)

Use only the authorized owner connection and the existing private tables;
never output match rows/IDs or extend the years. The following is the exact
query reproduced on 2026-11-10.

~~~sql
WITH seasons(season,bit) AS (
 VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
        ('2022/23',16),('2023/24',32),('2024/25',64)
), memberships AS (
 SELECT DISTINCT s.season,m.home_team_id AS club_id
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN seasons v ON v.season=s.season
 UNION
 SELECT DISTINCT s.season,m.away_team_id AS club_id
 FROM ff_private.ff_rpl_history_matches m
 JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
 JOIN seasons v ON v.season=s.season
), masks AS (
 SELECT m.club_id, SUM(s.bit)::int AS mask
 FROM memberships m JOIN seasons s ON s.season=m.season GROUP BY m.club_id
), public_events(event_key,season,day_utc,scheduled_utc,home_mask,away_mask) AS (
 VALUES
 ('sochi_spartak_a','2023/24',DATE '2023-09-16',
  TIMESTAMPTZ '2023-09-16 16:00:00+00',127,62),
 ('sochi_spartak_b','2023/24',DATE '2024-04-13',
  TIMESTAMPTZ '2024-04-13 11:00:00+00',62,127)
), candidates AS (
 SELECT e.event_key,m.kickoff_at,mh.mask AS home_mask,ma.mask AS away_mask
 FROM public_events e
 JOIN ff_private.ff_rpl_history_snapshots s ON s.season=e.season
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
  AND (m.kickoff_at AT TIME ZONE 'UTC')::date=e.day_utc
 JOIN masks mh ON mh.club_id=m.home_team_id
 JOIN masks ma ON ma.club_id=m.away_team_id
)
SELECT e.event_key,
 COUNT(c.event_key)::int AS all_private_fixtures_on_utc_day,
 COUNT(*) FILTER (WHERE c.home_mask=e.home_mask
 AND c.away_mask=e.away_mask)::int AS masked_direction_candidates,
 COUNT(*) FILTER (WHERE c.home_mask=e.home_mask
 AND c.away_mask=e.away_mask
 AND c.kickoff_at=e.scheduled_utc)::int AS exact_scheduled_utc_minute_candidates,
 COUNT(*) FILTER (WHERE c.home_mask=e.home_mask
 AND c.away_mask=e.away_mask
 AND c.kickoff_at BETWEEN e.scheduled_utc-INTERVAL '1 hour'
 AND e.scheduled_utc+INTERVAL '1 hour')::int AS within_one_hour_candidates
FROM public_events e LEFT JOIN candidates c ON c.event_key=e.event_key
GROUP BY e.event_key ORDER BY e.event_key;
~~~

Results: for both events (4,1,1,1), in the order listed above.
See the standalone public-safe receipt M3_OFFICIAL_SCHEDULED_UTC_EVIDENCE.json.
The pure Python audit checks article URL/date, official home/away,
mask 62/127, Europe/Moscow→UTC, event counts, conflicts with the prior
eight-date evidence and that **all eligibility/disclosure gates remain false**.

Next: independently map original private IDs to official club identities,
confirm actual played-vs-awarded/revised results and verified historical
source rights/first-serving clocks, then produce a defensible per-season
eligible row denominator. **Zero independently eligible rows in this
receipt means zero attested, not zero real played matches.**
