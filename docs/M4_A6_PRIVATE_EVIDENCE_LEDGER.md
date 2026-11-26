# M4-A6 private result evidence ledger (candidate-only, 2026-11-25)

This proposed rewrite of the **unapplied** migration 0017 follows the
[owner-approved practical standard](M4_A6_PRACTICAL_RESULT_EVIDENCE.md)
and blocker [#333](https://github.com/StanleyLl0yd/FootballForecast/issues/333).
It is source-controlled schema preparation, **not permission to migrate,
write results, settle forecasts, calculate metrics, approve a model, publish
forecasts, or access the sealed 2025/26 holdout**.

## Evidence and trust boundaries

- Preserve OpenFoot explicit played *claims* or UNKNOWN, and MatchTV UNKNOWN.
  Do not turn two agreeing score displays into evidence of actual play.
- The existing private observations table also retains candidate official
  club or league-protocol claims and scoped RFS/KDK reviews. An official
  claim needs a complete counted-goal sequence (including explicit empty
  sequence for 0:0); contradictory/incomplete official claims can remain
  UNKNOWN. Source direction and original A5 capture/proof remain checked.
- A structural result candidate needs both provider observations plus either
  a league-protocol claim or two opposing-club claims, with separate
  publisher identities and distinct raw-body digests. The latest claims
  from every retained official publisher must not contradict the selected
  score or counted-goal sequence. A protocol cannot hide a newer conflict.
- KDK review is dated and scoped. The scope digest commits a separately
  retained review manifest; exact v1 manifest bytes can be retained in the
  unapplied schema (see [KDK retention](M4_A6_KDK_SCOPE_RETENTION.md)).
  V1 manifests are incomplete and cannot clear KDK; source digest and OIDC receipt remain
  independent raw-body observation evidence. The candidate requires the
  latest KDK no-adverse *claim*, covering all earlier recorded evidence.
  The four known round-15 agenda fixtures and previously unresolved cases
  require a claimed issued decision. The agenda itself is not a decision;
  an adverse decision cannot clear itself, even after intervening reviews.
  This does not establish the completeness, accuracy or legal effect of
  the manifest and never proves permanent clearance.
- A protected worker must separately prove permitted source use, pinned
  publisher URLs/MatchTV crosswalk, editorial independence, actual full-time
  and running-score semantics, all relevant issued KDK decisions/resolutions,
  raw-body retention and cryptographic OIDC audience/signatures. SQL cannot
  establish those facts from caller-supplied metadata. No new network fetch
  authority, privileges, security-definer functions or live worker.

## Immutable revisions

The two existing private tables keep FORCE RLS, revoked public/anon/
authenticated/service-role privileges and UPDATE/DELETE/TRUNCATE denial.
Every observation has a server-assigned capture-local ordinal and clock.
A fresh token and a different run may retain the same source bytes again;
a reused token or duplicate capture/issuer/publisher/run/attempt is refused.
A delayed non-advancing publisher receipt is refused as well.
The existing 20-minute freshness requirement applies only to the **insertion
of an observation**, not to the age of earlier retained independent
observations. They may originate in distinct protected runs.

Observation and candidate appenders serialize on the capture row under
READ COMMITTED. The candidate's server-assigned evidence cutoff ordinal
must be compared with the latest observation ordinal; any later evidence
makes the old candidate stale. A subsequent review appends a new revision
pointing to the preceding revision of the same original FORECAST; it
cannot fork, skip or overwrite. A positive candidate cannot reuse an
unchanged cutoff. A single BLOCKED revision can revoke an existing candidate
at the same cutoff (for example, later discovery of invalid provenance);
reinstatement or another block requires new evidence. A BLOCKED revision
has no score and no authority, and may retain references to incomplete or
conflicting evidence. ABSTAIN never enters the candidate ledger,
and a superseded FORECAST cannot receive a result candidate.

All played-final, KDK clearance, settlement, scoring, model approval,
publication and holdout flags remain false. No read model or scoring
consumer is authorized. A future reviewed consumer must also check latest
revision/cutoff and current evidence/forecast validity, and invalidate stale
evaluations when authorized; there are currently no such evaluations.

## Verification / remaining gates

Disposable PostgreSQL 17 only: test UNKNOWN, false played, missing and
duplicate official witnesses, counted-goal contradictions, scoped pending
KDK/adverse decisions, repeated body vs replay, append-only revisions,
ABSTAIN, privilege denial and immutability. The dedicated disposable CI concurrency script checks two overlapping
observation writers, a candidate racing newly committed evidence, and
competing first-candidate revisions. These tests and the complete repository
CI/audits must pass before accepting the schema proposal. Source/legal review and a protected worker remain
outstanding. A separate owner approval is required before applying 0017 to
live Supabase, and separate authorization before any private settlement.

M4 remains 5/8 ACCEPTED; A6–A8 OPEN.
