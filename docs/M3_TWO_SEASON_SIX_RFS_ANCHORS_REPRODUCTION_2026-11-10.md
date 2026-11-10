# M3-A3 · Six official RFS anchors for 2021/22 and 2022/23

**2026-11-10, private SELECT-only aggregate. A3 OPEN; M3 remains 2/8.**

[Public-safe receipt](M3_TWO_SEASON_SIX_RFS_ANCHORS_EVIDENCE.json) · [Seven-season public roster masks](M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json) · [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271)

## Independent first-party source selection

The two years **2021/22 and 2022/23** were missing from the **checked pinned OpenFootball CC0 paths** in the five-season study. They are **not missing seasons in football history**. The Russian Football Union provides separately identifiable retrospective official schedules:

- [RFS 2021/22 calendar](https://www.rfs.ru/tournament/1349/calendar?round_id=18268), 16 league clubs / 30 rounds
- [RFS 2022/23 calendar](https://www.rfs.ru/tournament/1395/calendar?round_id=18419), 16 league clubs / 30 rounds
- [RFS referee appointment before 2021/22 opening](https://www.rfs.ru/news/214019), page displays 2021-07-21 12:50 MSK; independent first-serving instant **not** verified
- [RFS referee appointment before 2022/23 opening](https://www.rfs.ru/news/216285), page displays 2022-07-13 16:30 MSK; independent first-serving instant **not** verified
- RFS played-match round recaps: [2021-07-26](https://www.rfs.ru/news/214027), [2022-07-17](https://www.rfs.ru/news/216299)
- **Administrative revision**: [RFS disciplinary decision 2023-03-22](https://www.rfs.ru/news/217736), [appeal rejected](https://www.rfs.ru/news/218012), [RFS match record](https://www.rfs.ru/match/51021?mobile=no). **Pari NN–Torpedo was actually played 1:1 on 2023-03-19** but later recorded as **official 0:3**.

These are **six manually chosen source anchors**, not extraction or machine reuse of the entire federation season. No bulk RFS source, protected private club names/IDs, per-match private scores, or source records were imported or committed.

## Retrospective schedule-to-private aggregate correspondence

The public **Moscow-local schedule** was converted to UTC using `Europe/Moscow`. For each independently named public event, the seven-season public roster participation masks for its home and away sides were matched against **anonymous masks computed inside the private PostgreSQL database**. For each event the SELECT returned only same-UTC-day private fixture count, directed mask candidate count, exact provider UTC-minute candidate count, and the **count** where provider official-result *shape* agrees; no private row or ID ever left SQL.

| Season | First-party public event | RFS retrospective Moscow time | UTC candidate | Public official score | Private exact-minute+mask candidates | Score agreements |
| --- | --- | --- | --- | --- | ---: | ---: |
| 2021/22 | Khimki–Zenit, 2021-07-24 | 17:30 | 14:30Z | 1:3 | 1 | 1 |
| 2021/22 | Krylia Sovetov–Nizhny Novgorod, 2021-10-17 | 16:30 | 13:30Z | 2:0 | 1 | 1 |
| 2021/22 | Sochi–Krylia Sovetov, 2022-03-20 | 16:30 | 13:30Z | 2:3 | 1 | 1 |
| 2022/23 | Torpedo–Sochi, 2022-07-17 | 15:00 | 12:00Z | 1:3 | 1 | 1 |
| 2022/23 | Torpedo–Zenit, 2022-11-12 | 16:30 | 13:30Z | 0:2 | 1 | 1 |
| 2022/23 | Pari NN–Torpedo, 2023-03-19 | 16:30 | 13:30Z | **0:3, revised after play** | 1 | 1 |

Aggregate: **6/6 public calendar events, 6 directed mask candidates, 6 exact-minute candidates, 6 official-result agreements**. There is **one** administrative revision. Two 2021/22 Krylia observations consistently refer to **one** internal anonymous private club ID; three 2022/23 Torpedo observations likewise refer to **one** internal anonymous club ID. These equality checks used private IDs only as in-query grouping keys; **no private identifier values were returned**.

## Exact SQL read-only shape

The executed query follows the same public-event `VALUES` and private seven-year membership-mask pattern as [the existing anonymous official graph](M3_MASK127_OFFICIAL_FIXTURE_ANCHOR_REPRODUCTION_2026-11-10.md), except its six event constants are for two previously unrepresented seasons, and it compares only privately aggregated official-score *counts*.

```sql
WITH years(season,bit) AS (
  VALUES ('2018/19',1),('2019/20',2),('2020/21',4),('2021/22',8),
         ('2022/23',16),('2023/24',32),('2024/25',64)
), membership AS (
  SELECT DISTINCT s.season,m.home_team_id team
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN years y ON y.season=s.season
  UNION
  SELECT DISTINCT s.season,m.away_team_id team
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN years y ON y.season=s.season
), mask AS (
  SELECT membership.team,SUM(years.bit)::int bits
  FROM membership JOIN years ON years.season=membership.season
  GROUP BY membership.team
), evidence(code,season,utc,hm,am,official_h,official_a) AS (
  VALUES
  ('khimki_zenit_open_2021','2021/22',
   timestamptz '2021-07-24 14:30:00+00',92,127,1,3),
  ('krylia_nizhny_2021','2021/22',
   timestamptz '2021-10-17 13:30:00+00',123,120,2,0),
  ('sochi_krylia_2022','2021/22',
   timestamptz '2022-03-20 13:30:00+00',62,123,2,3),
  ('torpedo_sochi_open_2022','2022/23',
   timestamptz '2022-07-17 12:00:00+00',16,62,1,3),
  ('torpedo_zenit_2022','2022/23',
   timestamptz '2022-11-12 13:30:00+00',16,127,0,2),
  ('pari_torpedo_revised_2023','2022/23',
   timestamptz '2023-03-19 13:30:00+00',120,16,0,3)
), candidates AS (
  SELECT e.code,e.utc,e.official_h,e.official_a,
         m.kickoff_at,m.home_goals,m.away_goals
  FROM evidence e
  JOIN ff_private.ff_rpl_history_snapshots s ON s.season=e.season
  JOIN ff_private.ff_rpl_history_matches m ON m.snapshot_id=s.id
  JOIN mask h ON h.team=m.home_team_id AND h.bits=e.hm
  JOIN mask a ON a.team=m.away_team_id AND a.bits=e.am
  WHERE (m.kickoff_at AT TIME ZONE 'UTC')::date =
        (e.utc AT TIME ZONE 'UTC')::date
)
SELECT e.code,COUNT(c.code)::int same_day_mask_candidates,
       COUNT(c.code) FILTER(WHERE c.kickoff_at=e.utc)::int exact_minute,
       COUNT(c.code) FILTER(WHERE c.kickoff_at=e.utc AND
         c.home_goals=e.official_h AND c.away_goals=e.official_a)::int
         official_score_agreements
FROM evidence e LEFT JOIN candidates c ON c.code=e.code
GROUP BY e.code ORDER BY e.code;
```

The two separate internal equality checks additionally counted `DISTINCT` *opaque* club IDs across the two Krylia and three Torpedo anchors respectively and returned only **2→1** and **3→1** cardinalities. Read-only source access was restricted to seven development seasons, actual match scans for the selected 2021/22–2022/23 windows. No migrations, functions, private exports, or heldout reads.

A pure receipt audit checks **exact** event constants, `Europe/Moscow` conversion, already-reviewed public roster masks, same-day/exact-minute/score aggregate counts and administrative-revision facts, plus security/eligibility denials. Unit tests mutate these fields to verify fail closed.

## Limits and downstream gate

The event 2023-03-19 is **strong positive evidence of a private finished source mirroring a later official result**, not on-field 0:3. The independent KDK text explicitly says it was **played 1:1**. Do not silently infer that 0:3 is 0–3 played goals or use it for Poisson attack/defense fitting.

Even the other five apparent exact official calendar matches do **not** independently certify private row identity, original kickoff, original serving UTC, complete source match chronology, source rights, or per-season usable cohort. The source still lacks first-publication metadata. The RFS HTML's visible dated announcement is not a cryptographically verified original timestamp. Official federation publication terms do not clear bulk training rights.

**M3-A3 remains OPEN, 2/8 criteria accepted; certified private training rows remain 0, meaning still unverified.** A4/A5 real training and evaluation forbidden; 2025/26 one-use holdout not accessed; production, RLS, escrow, source data and forecasts unchanged.
