# Security policy

FootballForecast currently provides **public, anonymous, read-only** non-commercial analytics. Report vulnerabilities privately to the repository owner, never in public issues with secrets.

## Active protections

- All nine Supabase `ff_*` tables have RLS. Only six non-personal catalogs, fixtures and published forecast/evaluation tables grant `anon` SELECT with explicit read policies; `anon` cannot write or see grants, raw provider records, license metadata or the private authorization schema. This was checked in the real Frankfurt Free project.
- Postgres live forecast and outcome records are append-only, with publication-time and fixture integrity guards. Untrusted browser clients are never provisioned as database writers.
- Administrative `/admin` is denied unless an explicitly configured, verified owner-only GitHub OAuth identity is present. Owner login is optional and is **not yet enabled**; public pages do not require login.
- No service-role key, privileged user token, third-party football provider credential or editable job API is present in the browser code. Next.js sets framing/sniffing restrictions and a minimal CSP.
- Protected `main` requires PRs and six exact-head CI/security checks; actions are pinned. `npm ci`, Gitleaks, CodeQL and production dependency audit are enforced. The **full development audit is fail-closed** for any new HIGH/CRITICAL finding: an explicit machine-checked exception permits only unpatched `braces@3.0.3` / `GHSA-vfj7-8cjw-p6xm` propagated along a verified, exclusively dev-only ESLint dependency chain. This is not a vulnerability fix or a permanent general waiver. **On 2026-10-22 the owner explicitly accepted this *exact dev-only residual risk* as non-gating for M0**. Issue #8 remains **OPEN solely for upstream patch monitoring**, not as an M0 failure.
- External HTTP canary verifies public health/pages, anonymous Supabase availability through the rendered dashboard, and unauthenticated admin redirects. Do not confuse a passing canary with a complete security penetration test.

## Accepted dev-only advisory risk (owner decision, 2026-10-22)

- **Scope:** only `GHSA-vfj7-8cjw-p6xm` affecting `braces@3.0.3`, exclusively within the pinned `eslint-config-next@16.4.2 -> @next/eslint-plugin-next@16.4.2 -> fast-glob@3.3.1 -> micromatch@4.0.8 -> braces@3.0.3` chain, with `dev: true` at every lockfile node. Acceptance does **not** extend to other vulnerabilities, new versions, unknown nested copies, production dependencies, new paths, or build/runtime exposure.
- **Controls retained unchanged:** production dependency audit (`npm audit --omit=dev --audit-level=high`), full `npm audit --json` through `scripts/m0-audit-dev-exception.mjs` and its negative tests, secret scanning, CodeQL, protected PR checks and weekly Dependabot. The full-audit exception still fails closed on changed advisory ID/severity, unexpected HIGH/CRITICAL findings, changed nodes or any non-dev-only copy. No blanket audit disable, arbitrary `npm audit fix --force`, unreviewed fork, or fabricated patched release.
- **Residual uncertainty:** development and CI processes execute or analyze project files; despite a strictly dev-only lockfile graph, this waiver does not establish exploit impossibility, eliminate risk in maintainer environments, or attest actual deployed bundle contents byte-for-byte. Public web runtime remains anonymous and read-only; no production account/user mutation/API integration is authorized by this waiver.
- **Review trigger and exit:** issue [#8](https://github.com/StanleyLl0yd/FootballForecast/issues/8) remains **OPEN, non-gating**. Review whenever Dependabot proposes an upstream change, the GitHub advisory publishes a fix/changes severity, a lockfile graph or deployment boundary changes, or another HIGH/CRITICAL finding appears; otherwise check during routine weekly dependency updates and before subsequent milestone security sign-off. Once a supported patched dependency and clean full audit are verified, **remove the explicit exception and its tests**, verify exact-head and post-merge CI, then close #8. If the risk expands to production or cannot be isolated, revoke this acceptance until mitigated.
- **M0 impact:** the owner accepts this *specific* risk, so #8 is no longer a milestone-blocking criterion. This does not satisfy unrelated RPL input licensing/accuracy (#2), data readiness, or full milestone audit; M0 was accepted on 2026-10-29 and M1 remains OPEN.

## Open risks

- Actual cross-network reachability from Russia and real browser security/compatibility tests.
- Database backup and restore, outage/runbook practice, free-project pausing and hosting non-commercial limits.
- Stronger CSP, CSRF/origin validation for future writes, rate limits and threat modeling before any worker, user account or mutable endpoint exists.
- Optional future OAuth: exercise real sessions, callback allowlists, logout, failed/forged provider identities and row-level grants before enabling owner admin.
- Explicit permission to retain/train on licensed football datasets, immutable upstream timestamp evidence and competition rights.

Never paste authentication secrets into issues, files or public logs, enable paid tiers, or expose a mutation route without security acceptance.
