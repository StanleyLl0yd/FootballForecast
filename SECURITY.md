# Security policy

FootballForecast currently provides **public, anonymous, read-only** non-commercial analytics. Report vulnerabilities privately to the repository owner, never in public issues with secrets.

## Active protections

- All nine Supabase `ff_*` tables have RLS. Only six non-personal catalogs, fixtures and published forecast/evaluation tables grant `anon` SELECT with explicit read policies; `anon` cannot write or see grants, raw provider records, license metadata or the private authorization schema. This was checked in the real Frankfurt Free project.
- Postgres live forecast and outcome records are append-only, with publication-time and fixture integrity guards. Untrusted browser clients are never provisioned as database writers.
- Administrative `/admin` is denied unless an explicitly configured, verified owner-only GitHub OAuth identity is present. Owner login is optional and is **not yet enabled**; public pages do not require login.
- No service-role key, privileged user token, third-party football provider credential or editable job API is present in the browser code. Next.js sets framing/sniffing restrictions and a minimal CSP.
- Protected `main` requires PRs and six exact-head CI/security checks; actions are pinned. `npm ci`, Gitleaks, CodeQL and production dependency audit are enforced. The **full development audit is fail-closed** for any new HIGH/CRITICAL finding: an explicit machine-checked exception permits only unpatched `braces@3.0.3` / `GHSA-vfj7-8cjw-p6xm` propagated along a verified, exclusively dev-only ESLint dependency chain. This is not a vulnerability fix or a permanent general waiver. Issue #8 remains OPEN until an actual upstream patch or safe supported replacement is proven.
- External HTTP canary verifies public health/pages, anonymous Supabase availability through the rendered dashboard, and unauthenticated admin redirects. Do not confuse a passing canary with a complete security penetration test.

## Open risks

- Actual cross-network reachability from Russia and real browser security/compatibility tests.
- Database backup and restore, outage/runbook practice, free-project pausing and hosting non-commercial limits.
- Stronger CSP, CSRF/origin validation for future writes, rate limits and threat modeling before any worker, user account or mutable endpoint exists.
- Optional future OAuth: exercise real sessions, callback allowlists, logout, failed/forged provider identities and row-level grants before enabling owner admin.
- Explicit permission to retain/train on licensed football datasets, immutable upstream timestamp evidence and competition rights.

Never paste authentication secrets into issues, files or public logs, enable paid tiers, or expose a mutation route without security acceptance.
