# M2 full repository exit audit: two passes · 2026-11-09

**Scope:** the *entire* `StanleyLl0yd/FootballForecast` repository, not a PR diff.
**Final audited baseline:** protected `main=e4a0853ff3abc60e1a6c30b785c9921b66d767ff`,
Git tree `23b57107538aff8cae322c466af6511617843456`.
**Owner acceptance 2026-11-09:** both complete audits and documented exceptions explicitly accepted in [#182](https://github.com/StanleyLl0yd/FootballForecast/issues/182). **M2 ACCEPTED 8/8**; model production approval and M3 are not authorized. The reviewed baseline below predates this sign-off.

## Complete pass 1: file-by-file source, tests, documents and access-boundary scan

All **389 tracked blobs** on exact pre-#263 protected
`2e2bb2394b00d1c6a3fb8dc735f3fecddcaa9126` were enumerated using an
untruncated recursive Git tree and fetched in bounded batches, indices 0–388
with no files skipped. Reviewed M0/M1 and M2 history, Go/No-Go study protocol,
Python model/evaluation/holdout code, PostgreSQL migrations/tests,
Next.js authentication and anonymous surfaces, external source adapters,
GitHub Actions gates, supply chain/backup scripts, all repository tests,
security assets, and evidence/documents.

The review found **CRITICAL** source-tree integrity regression introduced
by the subsequent PR #263: **11 files disappeared and eight unrelated existing
blob versions were reverted**, even though an incomplete CI tree was green.
Among the lost paths were the already executed private one-use workflow,
frozen study intent, SQL `0014` and `0023`, the day-only private model
evaluator/runner and their tests. This finding was not waived.

**Resolution:** protected [PR #264](https://github.com/StanleyLl0yd/FootballForecast/pull/264)
restored the **exact nineteen pre-#263 Git blobs**, preserving the eight
legitimate changed files and three new #263 evidence files. A new permanent
`tests/m2-repository-continuity.test.mjs` guards source-tree continuity,
including the one-use scorer, SQL migration, CI PG17 integration, GitHub
workflow, independent provider mapping and SHA-pinned disaster recovery.
Exact PR #264 HEAD: `b511b800cd7c4d17ec5a8434bb32f4dba8712c1f`,
**10/10 SUCCESS**; protected squash with matching Git tree.

## Complete pass 2: independently reconciled current full tree, live security and integrated execution

A second **whole-repository** object reconciliation on the new protected
`main` enumerated **393 tracked blob files** with
`truncated=false`. Exact comparison against the full 389-file input set:
**389/389 retained, 0 missing, 0 unexpected modifications**; precisely
four reviewed new paths and eight reviewed modified paths.
The second pass did not rely only on changes from the last PR:
all repository sectors were included and their cross-component contracts
checked by the exact-main full suite and live read-only runtime inspection.

| Repository sector | Tracked files | Verification |
| --- | ---: | --- |
| Workflows | 16 | owner-only triggers, permissions, pinned actions, no persisted checkout credentials; CI/Security/CodeQL |
| Next.js/UI/auth/tests | 79 | anonymous REST vs owner GitHub OAuth, negative identity tests, server-only research page, fail-closed SHA receipt, Safari/Firefox/Edge |
| PostgreSQL migrations / tests | 14 / 24 | PG17 migrations and rollback; public grants, private one-use FK, RLS/trigger immutability, isolated PostgREST |
| Python source / tests | 29 / 26 | fixed Poisson 2024/25, 2025/26 day-only single-run boundaries, identity map, scoring, history and chronology; 295 pytest PASS, Ruff PASS |
| Scripts and integration tests | 54 / 72 | source normalization, bounded URLs, private imports, source-quality and disaster recovery; Node tests and PG17 isolated restore PASS |
| Docs and pinned evidence | 65 | frozen source/model/source receipts, pre-read claim vs post-read CSV hash, signed Git run, historical-study restrictions |
| Root/config and security | 13 + 1 | `npm audit --omit=dev`: 0 vulnerabilities; full audit 0 HIGH/CRITICAL, secret scan and pinned `age` binary SHA |

Exact-main nine required checks at commit `e4a0853...`: **9 PASS / 0 FAIL**
(`python-core`, `web`, browser-compatibility, Safari, production smoke,
secret scan, dependency audit and both CodeQL languages).
Verified `python-core` logs: **295 pytest passed**, Python Ruff passed,
PG17 M2 immutable claim/result SQL and 7-season private history integration
passed, isolated PostgREST anonymous reads/denials passed.
Verified encrypted PostgreSQL disaster-recovery round-trip, tamper rejection,
RLS/trigger persistence and source-pinned `age` download.

**Live Supabase Frankfurt, SELECT-only checks**:
seven private historical snapshots, 1,680 development matches, one real
train-only model, one consumed 2025/26 one-use claim, one immutable private
aggregate score, **0 published forecasts**. Claim/result join matched
`study_id + github_run_id + predeclared_names_sha256`. All 11
`ff_private` tables have RLS enabled and
**no `anon`/`authenticated`/`service_role` SELECT or INSERT grants**.
All five M2 history/model/first-score tables have FORCE RLS and enabled
immutable UPDATE/DELETE and TRUNCATE triggers.
Nine `public.ff_*` tables have intended policies and non-mutating
anonymous/public read grants; `ff_private.ff_is_authorized` is the sole
authorization SECURITY DEFINER helper (empty search_path, no anon EXECUTE).

**Production verification:** Vercel Hobby `fra1`, primary alias
`footballforecast.vercel.app` points to
`dpl_Aa7nvbNwmwyZHELqnzJKTwykAS96` READY, matching exact main Git
SHA and reviewed tree. Live production canaries and browser compatibility pass.

## Finding register and accepted limitations

| Severity | Finding | State / decision |
| --- | --- | --- |
| CRITICAL | Incomplete source tree after #263 silently removed one-use study chain | **FIXED** in #264; all 393 paths reconciled; continuity regression test and full PG17 checks pass |
| RESEARCH LIMITATION | Original external RPL 2025/26 CSV was not retained verbatim | **OPEN, explicit exit acceptance required**. Only SHA and private aggregates survive. Cannot promise byte-identical independent replay; **never rerun consumed holdout** |
| RESEARCH LIMITATION | Day-only retrospective, no independently authenticated UTC kickoffs / as-of availability or bookmaker comparison | **OPEN, non-production research classification**; no superiority or calibrated pre-match claims |
| RESEARCH LIMITATION | Football-Data CSV full-time H/D/A scores were internally consistent but not independently reconciled match-by-match with official played-vs-awarded status; only the 14-team familiar subset was scored | **OPEN, acknowledge in interpretation**. Cannot guarantee outcome labels have no retrospective administrative changes or generalize performance to promoted clubs; do not revise the consumed evaluation |
| LOW / DEFENSE-IN-DEPTH | Six legacy M1 private tables have RLS but not FORCE RLS | **DEFERRED** pending compatibility review of privileged M1 import/maintenance; no browser/service SELECT or INSERT; all new M2 tables are forced |
| INFO | Supabase advisor: 11 private tables have RLS but no allow policies | **INTENTIONAL** deny-by-default; [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| LOW / CONDITIONAL | Supabase Auth password-leak protection disabled | **REVIEW CONFIGURATION**, GitHub OAuth-only owner access currently; do not enable new password login. [Auth guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| INFO | One missing composite FK index on one-row private score table; six currently unused indexes | **NOT PERFORMANCE BLOCKERS** at current scale; retain existing indexes. [FK advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| VERIFICATION GAP | Authenticated *non-owner* GitHub browser denial not manually observed | **OPEN**, synthetic identity-rejection tests and anonymous browser denial already PASS |

### Research interpretation and one-use integrity

The owner-only [one-use GitHub run #42590191735](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42590191735)
preserves 182 evaluated fixtures, 58 predeclared abstentions, fixed 2024/25
Poisson model and training-only 103/65/72 baseline. Its numerical metrics are
available **only in private Supabase**, not this public report or public website.
The model outperformed that naive baseline in this cohort, **without**
statistical superiority to bookmakers, independent bitwise replay, model
approval, public match predictions or authorization of M3.
The **source URL and model/code/method** were frozen *before* reading labels;
the **CSV source-byte and selected-row SHA** were recorded *after* the
single authorized read. Neither was claimed independently pre-read locked.

## Decision gate

Both complete repository-wide audit passes were recorded with remaining
exceptions explicitly visible. **On 2026-11-09, the owner accepted these findings
and limitations** in [issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182).
M2 is **ACCEPTED 8/8**, as a retrospective research milestone only.
Missing CSV bytes, unverified as-of, unreconciled awarded outcomes, restricted
182/240 coverage, unobserved non-owner browser denial and deferred defense in
depth are **not** claimed fixed. One-use 2025/26 evaluation must never be
repeated or tuned on, private metrics stay private, and neither production
forecast publication nor M3 is authorized. Production drift is tracked in
[issue #266](https://github.com/StanleyLl0yd/FootballForecast/issues/266).
