# Security policy

FootballForecast currently provides **public, anonymous, read-only** non-commercial analytics. Report vulnerabilities privately to the repository owner, never in public issues with secrets.

## Active protections

- All **15** Supabase tables have RLS: nine `public.ff_*` tables and six `ff_private` tables. Only six non-personal public catalog, fixture and forecast/evaluation tables grant `anon` SELECT. Neither `anon` nor `authenticated` has table write privileges; private source tables and ingest procedures are inaccessible to browser roles. The `ff_private.ff_is_authorized()` helper is intentionally callable by `authenticated` solely for RLS authorization checks, not ingestion. This permission inventory was verified read-only against the live Frankfurt Free database on 2026-11-01.
- Postgres live forecast and outcome records are append-only, with publication-time and fixture integrity guards. Untrusted browser clients are never provisioned as database writers.
- Administrative `/admin` is denied unless an explicitly configured, verified owner-only GitHub OAuth identity is present. Owner login is optional and is **not yet enabled**; public pages do not require login.
- No service-role key, privileged user token, third-party football provider credential or editable job API is present in the browser code. Next.js sets framing/sniffing restrictions and a minimal CSP.
- Protected `main` requires PRs, squash-only merges, resolved review threads and six strict exact-head CI/security checks; force-push/deletion and bypasses are prohibited; actions are pinned. `npm ci`, Gitleaks, CodeQL and both production-only and full dependency audits are enforced. **Full `npm audit --audit-level=high` now runs without any exception**; every HIGH/CRITICAL finding fails CI. The prior `braces@3.0.3` advisory `GHSA-vfj7-8cjw-p6xm` was [withdrawn by GitHub on 2026-10-23](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), because it was not practically exploitable. No patched `braces` version is claimed. A direct clean full-audit result, not a waiver, is the required control.
- External HTTP canary verifies public health/pages, anonymous Supabase availability through the rendered dashboard, and unauthenticated admin redirects. Do not confuse a passing canary with a complete security penetration test.

## Withdrawn dev-only advisory: resolved 2026-11-10

M0 was accepted on 2026-10-29; M1 was accepted on 2026-11-02. Their accepted status is unchanged by the subsequent advisory withdrawal.

The owner accepted a narrowly scoped temporary dev-only exception on 2026-10-22 while the `braces@3.0.3` high-severity advisory remained active and had no patched release. GitHub [withdrew GHSA-vfj7-8cjw-p6xm on 2026-10-23](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stating that it was **not a practically exploitable vulnerability**. Withdrawal, **not** a package patch, is why the special audit exception can be removed.

A genuine GitHub Actions security job on 2026-11-10 already reported **zero HIGH/CRITICAL findings in the full npm audit**. The production audit also found zero vulnerabilities. The CI now runs `npm audit --omit=dev --audit-level=high` **and** `npm audit --audit-level=high` directly after `npm ci`; both fail on new HIGH/CRITICAL findings. Gitleaks, CodeQL, locked dependencies and protected PR gates remain in force.

The old exception handler `scripts/m0-audit-dev-exception.mjs` and its dev-only exemption tests were removed, because retaining a waiver for a withdrawn advisory creates unnecessary future acceptance risk. This does **not** assert that all security risks are absent, that every dependency is harmless, or that any historical source-rights issue is resolved. [Issue #8](https://github.com/StanleyLl0yd/FootballForecast/issues/8) documents the original accepted risk and its resolution; no package downgrade, nonexistent `braces@3.0.4`, bypass or new credential was introduced.

## Open risks

- Actual cross-network reachability from Russia and real browser security/compatibility tests.
- Database backup and restore, outage/runbook practice, free-project pausing and hosting non-commercial limits.
- Stronger CSP, CSRF/origin validation for future writes, rate limits and threat modeling before any worker, user account or mutable endpoint exists.
- Optional future OAuth: exercise real sessions, callback allowlists, logout, failed/forged provider identities and row-level grants before enabling owner admin.
- Explicit permission to retain/train on licensed football datasets, immutable upstream timestamp evidence and competition rights.

Never paste authentication secrets into issues, files or public logs, enable paid tiers, or expose a mutation route without security acceptance.
