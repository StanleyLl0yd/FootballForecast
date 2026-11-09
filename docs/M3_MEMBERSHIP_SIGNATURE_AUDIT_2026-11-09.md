# M3-A3 · Seven-season membership signature comparison (partial evidence)

Observed **2026-11-09** in Supabase Frankfurt, PostgreSQL 17. This is **read-only, development-only, no scores and no row/ID export**. M3 remains **OPEN / 2 of 8 gates**. The one-use 2025/26 holdout was not accessed.

## Independent comparison

The already-reviewed seven RSSSF final tables ([public name-only roster evidence](M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json)) provide a set of 16 named clubs per season. Every public alias has a seven-bit participation mask, with bit 0 for 2018/19 and bit 6 for 2024/25. Separately, a read-only SQL query computed the **same mask from private provider IDs inside Postgres** and returned **only mask → number of anonymous clubs**, not the IDs or names themselves. No score or goals column was referenced. The aggregate-only receipt is [M3_SEVEN_SEASON_MEMBERSHIP_SIGNATURE_EVIDENCE.json](M3_SEVEN_SEASON_MEMBERSHIP_SIGNATURE_EVIDENCE.json).

The **entire 16-group mask histogram matches**, which is stronger than matching only 26 total IDs and 82 adjacent-season overlaps. Exactly 12 masks have a single club each, while 14 clubs share four ambiguous patterns (including eight clubs present in all seven seasons). There are 112 club-season appearances; all six adjacent overlaps total 82. A SHA-256 is computed over the canonical public-safe array \`[[mask,count],...]\` only. **That SHA is not an immutable private source-row hash, a database transaction proof, or a club identity receipt.**

An exact matching **membership pattern** is an identification *candidate*, not independently established correspondence of provider ID ↔ official club. Even singleton patterns do not attest original organization continuity, source clock, historic name, played status, match or legal identity. No private IDs were returned, mapped or disclosed. No real M3 training eligibility follows.

## Exact bounded SQL

Executed SELECT-only on \`ff_private.ff_rpl_history_snapshots\` and \`ff_private.ff_rpl_history_matches\`, restricted to seven development seasons, in a read-only transaction. Query output contains only mask and count:

\`\`\`sql
BEGIN READ ONLY;
WITH seasons(season, bit) AS (
  VALUES ('2018/19',1),('2019/20',2),('2020/21',4),
         ('2021/22',8),('2022/23',16),('2023/24',32),('2024/25',64)
), memberships AS (
  SELECT DISTINCT s.season, m.home_team_id AS team_id
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN seasons y ON y.season=s.season
  UNION
  SELECT DISTINCT s.season, m.away_team_id AS team_id
  FROM ff_private.ff_rpl_history_matches m
  JOIN ff_private.ff_rpl_history_snapshots s ON s.id=m.snapshot_id
  JOIN seasons y ON y.season=s.season
), masks AS (
  SELECT m.team_id, SUM(y.bit)::int AS season_membership_mask
  FROM memberships m JOIN seasons y ON y.season=m.season
  GROUP BY m.team_id
)
SELECT season_membership_mask AS mask, COUNT(*)::int AS club_count
FROM masks GROUP BY season_membership_mask
ORDER BY season_membership_mask;
COMMIT;
\`\`\`

\`ml/src/football_forecast/research/m3_membership_signature_audit.py\` performs a **pure, no-I/O recheck** of the frozen public roster, sampled private prior evidence, bounded histogram, all 16 group counts and SHA-256. Unit tests explicitly reject identical 26-club / 112-appearance / 82-overlap totals with a **different mask histogram**, metadata changes, any raw ID fields, real-training assertions and a 2025/26 season.

## Remaining blockers

A3 cannot pass until private ID ↔ official club correspondence is independently attested (using original source club/name/date provenance and actual match identity rather than score-based guessing). Played versus awarded/revised result reconciliation, authentic UTC kickoff/first-serving evidence, per-fixture provenance, rights, source confidentiality and eligibility denominators remain open. The private archive, RLS permissions, M2 escrow/model, production predictions and consumed holdout are unchanged.
