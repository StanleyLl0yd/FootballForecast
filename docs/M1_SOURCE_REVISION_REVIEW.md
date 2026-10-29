# M1: immutable Footbolno source revision review

## Purpose

The protected M1 importer stores each different upstream CSV content hash as a
new **append-only private snapshot**. Its existing canonical promotion procedure
correctly refuses contradictory published kickoffs, scores or statuses, rather
than silently rewriting matches. To make such refusals actionable without
exposing provider rows, migration `0008` adds
`ff_private.ff_preview_footbolno_revision(uuid)`.

This preview is **read-only** (`STABLE SECURITY INVOKER`), available only to a
privileged database operator, not to `anon`, `authenticated`, PostgREST's
public schema or a web endpoint. It returns **only counts**, snapshot IDs and
SHA-256 provenance, never private records, names, scores or match URLs.

## Operator sequence, zero-cost only

1. Execute the existing **manual**, main-restricted GitHub Actions M1 importer
   when a published Footbolno snapshot is available; it must pass normalization,
   independent corroboration, attribution, tenant-specific verified TLS,
   quality and role gates. Replaying identical source bytes does not duplicate
   snapshots.
2. Identify the newly inserted candidate snapshot privately, preferably by
   exact source SHA-256, and call
   `select ff_private.ff_preview_footbolno_revision('<snapshot-uuid>'::uuid);`
   through a privileged Supabase SQL client. Never put the database password,
   URI or raw source rows into GitHub comments or chat.
3. The protected manual import now automatically runs that same private preview
   **after** its atomic staging commit and prints only the sanitized per-season
   counters in the GitHub Actions job summary. This does not write public rows.
   If review fails after a successful stage, the workflow explicitly reports
   that staging was committed but the review failed, never claiming a rollback.
   The report validator rejects unexpected fields/counters, invented historical
   as-of approval, and auto-promotion claims. Nothing is uploaded as an artifact.
4. The preview selects the latest **published** snapshot as the baseline.
   It rejects unknown/disallowed source or reversed retrieval chronology;
   enforces 720 rows, three 240-row seasons, roles, 16 distinct teams each,
   valid scores and confirmed timestamps, and no quarantines.
5. Compare by **season + directed provider team IDs**, never fuzzy names or
   source match IDs. Review totals for added, removed, changed, unchanged,
   score/status/kickoff/calendar/name/provider-ID edits, newly confirmed times,
   newly finished matches, finished-result regressions, and changes to sealed
   historical seasons.
6. A newly confirmed current-season kickoff is expected data improvement, but
   any actual difference still returns `requires_review=true` and
   `auto_updates_enabled=false`. **There is no automatic publication or
   correction in this migration.** Review source accuracy and any incumbent
   immutable prediction/outcome references before implementing a separately
   tested, versioned correction transaction.
7. Preserve the 2025/26 sealed holdout, unproven historical as-of timestamps,
   existing forecasts and all prior source snapshots. If the publisher changes
   historical scores, do not silently rewrite training/evaluation evidence or
   claim old backtests were contemporaneous. Use separate, dated dataset
   revisions with independently auditable evidence.

The initial production baseline on 2026-10-29 consists of 720 protected rows,
616 public canonical matches, 104 date-only future records kept private,
19 provider-mapped clubs and zero published forecasts. A read-only preview of
that **same** snapshot must report 720 unchanged, 0 modified and
`requires_review=false` (the summary does not independently prove provider
truth or historical time-of-publication). Synthetic CI creates a second
revision with one corrected **holdout score** and one newly confirmed
**current-season kickoff** inside a rolled-back transaction. The expected
summary is 2 modified, 718 unchanged, 1 score change, 1 new confirmed time,
1 historical holdout change, and no public-table writes.

Free-only requirement, attribution and existing owner-accepted #6/#8/#96 risks
remain unchanged. M1 is OPEN; M2 has not been authorized.
