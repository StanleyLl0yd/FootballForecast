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

1. The existing **protected** GitHub Actions M1 importer runs automatically at
   06:17 and 18:17 UTC each day and once after its workflow file changes on
   protected `main`. An optional manual dispatch requires
   `STAGE_FOOTBOLNO_PRIVATE`. Every run must pass normalization,
   independent corroboration, attribution, tenant-specific verified TLS,
   quality and role gates. Replaying identical source bytes does not duplicate
   snapshots.
2. Identify the newly inserted candidate snapshot privately, preferably by
   exact source SHA-256, and call
   `select ff_private.ff_preview_footbolno_revision('<snapshot-uuid>'::uuid);`
   through a privileged Supabase SQL client. Never put the database password,
   URI or raw source rows into GitHub comments or chat.
3. The protected import automatically runs that same private preview
   **after** its atomic staging commit and prints only the sanitized per-season
   counters in the GitHub Actions job summary. The preview alone does not
   write public rows.
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

After a **new and different** publisher snapshot has passed the protected
ingestion and aggregate revision review, a separate, bounded decision process
allows GitHub Actions to invoke
`select ff_private.ff_apply_safe_current_refresh('<candidate-uuid>'::uuid);`
**only when the count-level differences match the two explicitly permitted
current-season transition types**. This is never callable from a web route.
The existing manual Supabase SQL operator option remains available.

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

## Automated GitHub Actions operator path (M1)

Workflow: `.github/workflows/m1-private-stage-import.yml`, constrained to
protected `main` and the preconfigured `m1-source-import` Environment
(secrets `M1_PGHOST`, `M1_PGUSER`, `M1_PGDATABASE`,
`M1_PGPASSWORD`; optional pinned certificate). **No local Mac, password
entry, Vercel mutation endpoint or additional paid service is required.**

GitHub Actions `schedule` requests every day at **06:17 and 18:17 UTC**.
A protected main push changing this workflow also initiates one self-check.
Scheduled work uses the latest default-branch commit. GitHub may delay or skip
busy schedule windows, and GitHub can disable scheduled workflows after
60 days of inactivity on public repositories. It is a low-cost best-effort
sync cadence, **not a guaranteed live-score SLA**.

Every run:
1. Downloads at most 2 MB of licensed Footbolno CSV, normalizes three complete
   seasons and checks 2024/25 against pinned OpenFootball score evidence.
   Private raw rows exist only on the runner and protected DB. No provider
   artifacts or credentials are uploaded.
2. Atomically stages a new distinct source hash, or replays an existing one.
   A source bytes change does **not** automatically mean a fixture change.
3. Computes only a redacted revision summary. If all 720 records are
   unchanged, does **no public write**; if a historical/holdout/unknown change
   exists, outputs `PRIVATE_REVIEW_REQUIRED` and leaves the candidate
   **private** without silently correcting public history.
4. If and only if aggregate differences match safe current-season transitions,
   runs the existing `SECURITY INVOKER` guarded PostgreSQL procedure, which
   re-checks all per-match rules under a transaction/advisory lock and either
   commits **all** eligible changes with immutable audit evidence or rolls
   back. Results are summarized using a strict field allowlist.
5. Never trains ML, changes historical/holdout data or publishes a prediction.

The workflow keeps `contents:read`, HTTPS byte/time caps,
`PGSSLMODE=verify-full` and the pinned CA. SQL stderr and source rows are
never printed. A failure **after successful staging** accurately reports
that staging succeeded but public refresh was not confirmed. Anything outside
the safe transition policy requires a separate reviewed change, not a broad
automatic correction rule.

## Independent bounded current-day corroboration

A separate **unprivileged** `.github/workflows/m1-footbolno-dataset.yml`
research run checks licensed Footbolno and pinned OpenFootball consistency, then
performs at most **one** uniquely validated RPL SportScore search and **one**
competition-filtered UTC-day fixture request. This runs daily at **07:43 UTC**
and may also run on protected main updates or manual dispatch. It does **not**
have Supabase DB credentials, persist SportScore API rows, crawl match history,
train models, or insert public forecasts. Only aggregate discrepancy indicators
and the required `Powered by SportScore` attribution appear in the GitHub
Actions summary. Missing source, uncertain mapping, zero fixtures, or partial
API responses are labeled **INCONCLUSIVE**, not invented provider agreement.

This independent study is useful supporting evidence, **not a global 240-match
season certification** and not a promise of two independently authored
upstream records. The transactional current refresh continues to make only
the narrow changes authorized by migration `0009`.

## Conservative database-size fail-closed gate

Because two different upstream CSV byte hashes can normalize to the **same**
720 football fixtures, successive immutable source snapshots can consume
additional disk even with zero changes to the public catalog. Each snapshot
remains necessary as immutable evidence of the exact observed source, so
automatically deleting historic rows or changing their hashes is forbidden.

The protected SQL stage writer now checks PostgreSQL
`pg_database_size(current_database())` **inside its serialized transaction
before inserting a new SHA-256 snapshot**. At **256 MiB or more**, a *new*
source revision is declined before any rows are written; replays of an
already-staged source hash are still allowed. This 256 MiB ceiling is an
intentionally conservative **project-level safety threshold**, not a claim
about Supabase's contractual Free storage quota. It leaves capacity for
indexes, application tables and provider-specific overhead. It never
requests a billing upgrade or disables retention/access policy.

If the guard triggers, the workflow must clearly fail closed. Investigate
whether upstream bytes change with identical normalized fixtures, review
the size trend, and design a separate compact immutable *metadata-only*
observation ledger with migration/tests before resuming new snapshot
retention. **Do not delete accepted source history**, silently bypass the
threshold or drop the sealed 2025/26 evidence to keep the cron green.
