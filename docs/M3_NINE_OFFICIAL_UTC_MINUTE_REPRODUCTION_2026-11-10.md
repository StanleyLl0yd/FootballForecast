# M3-A3 · Nine RFS calendar minutes and anonymous 2023/24 Sochi fixture graph

**10 November 2026. Read-only correlation; A3 remains OPEN, M3 2/8.**

This receipt expands the two separately evidenced FC Sochi official pre-match scheduled
UTC minutes to **nine** 2023/24 Sochi RPL fixtures. The current retrospective
[official RFS 2023/24 match calendar](https://www.rfs.ru/tournament/1434/calendar?round_id=18568) provides
the observed local times, directions and match days. Cross-checking was performed
against [FC Sochi's August preliminary club calendar](https://pfcsochi.ru/news/2023-2024/rossiyskaya-premer-liga-predstavlyaet-raspisanie-matchey-mir-rpl-s-8-go-po-15-y-tury/),
its [September venue-swap update](https://pfcsochi.ru/news/2023-2024/rfs-i-rpl-soglasovali-perenos-matchey-mezhdu-sochi-i-spartakom/), and
the [April pre-match announcement](https://pfcsochi.ru/news/2023-2024/akkreditatsiya-smi-na-match-so-spartakom/).

| Public fixture | Date (UTC day) | Official Moscow schedule | Scheduled UTC | Public seven-season masks H/A | Private UTC-day rows | Correct mask+side | Exact minute |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| spartak–sochi | 2023-09-16 | 19:00 | 16:00Z | 127/62 | 4 | 1 | 1 |
| krylia–sochi | 2023-09-23 | 14:00 | 11:00Z | 123/62 | 3 | 1 | 1 |
| fakel–sochi | 2023-10-01 | 14:00 | 11:00Z | 112/62 | 3 | 1 | 1 |
| sochi–zenit | 2023-10-07 | 14:00 | 11:00Z | 62/127 | 4 | 1 | 1 |
| ural–sochi | 2023-10-22 | 12:00 | 09:00Z | 63/62 | 4 | 1 | 1 |
| nizhny_novgorod–sochi | 2023-10-29 | 14:00 | 11:00Z | 120/62 | 3 | 1 | 1 |
| sochi–dinamo_moscow | 2023-11-06 | 19:30 | 16:30Z | 62/127 | 3 | 1 | 1 |
| sochi–rubin | 2023-11-12 | 19:00 | 16:00Z | 62/111 | 4 | 1 | 1 |
| sochi–spartak | 2024-04-13 | 14:00 | 11:00Z | 62/127 | 4 | 1 | 1 |

**Important historical schedule discrepancy**: the club's August 18
preliminary schedule listed **Ural–Sochi, 22 October, 14:00 Moscow**.
The official RFS retrospective calendar gives **12:00 Moscow / 09:00Z**,
which exactly matches the anonymous private UTC-minute candidate. The
preliminary hour must not be treated as original kickoff truth.
The original August schedule also listed **Sochi hosting Spartak on
16 September**; a 7 September official club notice confirms their
venues/home-away ordering were swapped. The two reciprocal fixtures
are deliberately checked against the earlier committed two-minute receipt.

## Read-only PostgreSQL 17 verification

Against `ff_private.ff_rpl_history_snapshots` and
`ff_private.ff_rpl_history_matches`, SELECT-only SQL computed seven-season
participation masks **inside** the database; it did not export any private
ID, name, fixture, score, source row or goal. For each public event, a
timestamp/date/expected-home-and-away-mask join counted only candidate
rows. There were **nine of nine** exact-minute masked-direction matches,
each unique within its UTC day. The day totals were
`4, 3, 3, 4, 4, 3, 3, 4, 4` in fixture order.

Another SELECT-only equality aggregate (IDs used for COUNT(DISTINCT) inside
the database, never returned) found:
- 9 exact candidate rows across 9 distinct events;
- 1 consistent anonymous Sochi-mask-62 provider ID across all nine;
- 8 distinct anonymous opponents overall, 5 with singleton public
  seven-season masks and 3 with **ambiguous mask 127**;
- the two reciprocal public Spartak fixtures correspond to the
  **same anonymous mask-127 opponent**.

These are **strong structural calendar-consistency observations** only.
They do **not** independently certify that the private ID represents
Spartak, Zenit, Dynamo or any other named club; a seven-season mask
alone cannot map the eight indistinguishable mask-127 clubs.
Nor can current RFS retrospective display establish an authentic
historical source *first-serving* instant or actual played kickoff.
No played/technical-award or revised-goal truth was verified here.
The existing public roster aliases are retrospective, and training rights
remain unverified. **Zero attested eligible rows means not certified,
not that zero matches were played.**

## Reproducible aggregate SQL, no output IDs or scores

The following is the bounded nine-event count query used to produce the
public-safe aggregate receipt; dates are interpreted in UTC, not as original
provider first-publication timestamps.

```sql
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
), events(event,stamp,homemask,awaymask) AS (
 VALUES
 ('sochi_spartak_a',timestamptz '2023-09-16 16:00:00+00',127,62),
 ('sochi_krylia_sep23',timestamptz '2023-09-23 11:00:00+00',123,62),
 ('sochi_fakel_oct01',timestamptz '2023-10-01 11:00:00+00',112,62),
 ('sochi_zenit_oct07',timestamptz '2023-10-07 11:00:00+00',62,127),
 ('sochi_ural_oct22',timestamptz '2023-10-22 09:00:00+00',63,62),
 ('sochi_pari_oct29',timestamptz '2023-10-29 11:00:00+00',120,62),
 ('sochi_dynamo_nov06',timestamptz '2023-11-06 16:30:00+00',62,127),
 ('sochi_rubin_nov12',timestamptz '2023-11-12 16:00:00+00',62,111),
 ('sochi_spartak_b',timestamptz '2024-04-13 11:00:00+00',62,127)
), candidates AS (
 SELECT e.event,e.stamp,m.kickoff_at,mh.mask hm,ma.mask am
 FROM events e
 JOIN ff_private.ff_rpl_history_snapshots s ON s.season='2023/24'
 JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
   AND (m.kickoff_at AT TIME ZONE 'UTC')::date =
       (e.stamp AT TIME ZONE 'UTC')::date
 JOIN masks mh ON mh.club=m.home_team_id
 JOIN masks ma ON ma.club=m.away_team_id
)
SELECT e.event,COUNT(c.event)::int day_fixtures,
 COUNT(c.event) FILTER (
   WHERE c.hm=e.homemask AND c.am=e.awaymask
 )::int mask_role_candidates,
 COUNT(c.event) FILTER (
   WHERE c.hm=e.homemask AND c.am=e.awaymask AND c.kickoff_at=e.stamp
 )::int exact_minute_candidates,
 COUNT(c.event) FILTER (
   WHERE c.hm=e.homemask AND c.am=e.awaymask
   AND c.kickoff_at BETWEEN e.stamp - interval '1 hour'
                        AND e.stamp + interval '1 hour'
 )::int within_hour_candidates
FROM events e LEFT JOIN candidates c ON c.event=e.event
GROUP BY e.event ORDER BY e.event;
```

The separate graph-equality SELECT produced the anonymous counts in the JSON
receipt, including `COUNT(DISTINCT)` on **private IDs only inside SQL**.
Neither query read a score field. The JSON is synthetic-identity-free
metadata, not a public research export. The Python audit checks exact
calendar/mask/minute counts, conflicting preliminary schedule flags,
past two-minute evidence, private-disclosure absence and closed A3 gates.

**Next:** independently verify private provider-name and public club
crosswalk without goal-derived matching, played versus technical/revised
status, actual UTC kickoff, original first-serving UTC, source rights,
and the per-season eligible denominator. Until then A3/A5 real evaluation
is forbidden, and A4 remains synthetic-only. No Supabase mutations,
RLS, M2 escrow, consumed 2025/26 holdout, public forecasts, paid
services or secrets were changed.
