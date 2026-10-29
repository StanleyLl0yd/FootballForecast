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

## Explicit guarded current-season refresh (migration 0009)

After a **new and different** publisher snapshot has passed the existing
manual protected ingestion and aggregate revision review, a privileged
operator may invoke
`select ff_private.ff_apply_safe_current_refresh('<candidate-uuid>'::uuid);`.
This is **not** called automatically by GitHub Actions or a web route.

The operation takes the same serialized PostgreSQL advisory lock as canonical
promotion and executes as **SECURITY INVOKER**. `anon` and `authenticated`
have no EXECUTE privilege. It permits only:

- A previously date-only *scheduled* 2026/27 fixture gaining an exact,
  confirmed kickoff time; this creates its missing canonical public match
  without fabricating a midnight kickoff.
- An already published *scheduled* 2026/27 fixture becoming *finished*
  with validated final goals, the **same confirmed kickoff and identity**,
  and a source retrieval timestamp no earlier than the kickoff. It records
  old/new score and source IDs in an RLS-protected, append-only private audit
  table `ff_current_refresh_events` before updating the canonical match.

All changes must be explainable by exactly these two transition counts. The
transaction refuses any changed historical training/holdout record, added or
removed fixture identity, changed club/source names, a changed confirmed
kickoff, calendar move, finished-score correction, or status regression.
The existing immutable forecast/outcome triggers retain authority.
Any failure aborts the **whole** transaction: no partial scoreboard update,
no partially inserted snapshot links or audit event. Once published, retrying
the exact snapshot is an idempotent no-op.

The existing `ff_promote_footbolno_snapshot` routine is reused **after**
validated current-result transitions, so it continues enforcing its all-season
identity, status, kickoff and score comparisons, plus source attribution.
New source snapshots and prior event history are never overwritten.

A synthetic PostgreSQL 17 integration test creates successive snapshots for
one newly confirmed current kickoff, then that match's finished result, then
one forbidden sealed-holdout correction. It verifies exact public counts,
one append-only event, safe replay, rejected correction and a full ROLLBACK.

**Production limitation:** until another real, changed Footbolno snapshot
has been safely imported, the current live counts remain 720 protected rows
and 616 publicly promoted matches. Deployment of this routine is not proof
that any new real result has been refreshed. No M2 models or backtests
are enabled by this feature.
