# Known limitations - M0

- Public source is maintained on a protected `main` branch. CI, Security and CodeQL passed after the initial M0 PRs. No deployment or database instance is verified.
- A version 3 npm lockfile was generated and `npm ci` smoke-tested on a GitHub-hosted Node 22 runner; CI/Security now use `npm ci`. Remote web lint/typecheck/build previously passed; built-server HTTP and unconfigured headless Chrome smoke run in CI, but Safari/Firefox/Edge and real OAuth E2E remain unavailable; local registry access is still unavailable.
- Auth code prepared but not tested against real Supabase GitHub identities, callback allowlist, session expiry, or negative RLS policies.
- OAuth ownership predicate now has explicit non-owner/malformed-identity unit tests; production access remains blocked until checked against real Supabase GitHub identity response shapes, callback/session lifecycle and actual unauthorized requests.
- Core Poisson accepts input intensities; it has not learned team strengths, calibrated outcomes, or produced actual match forecasts.
- No data ingestion permitted. Source catalog and usage rights require further verification.
- Database migration is not applied to an actual Supabase project. CI uses a disposable PostgreSQL 16 database with simulated Supabase auth roles to check RLS, immutable forecasts and referenced fixture/result guards; actual Supabase REST tests, restore and disaster recovery remain outstanding.
- `forecast-v1` is a partial contract; final exchange schema needs full probability/tail and audit fields.
- UI uses honest empty states; filters, charts, model jobs, match detail and reports are not yet implemented.
- Required checks run on pull requests and protected `main`; do not confuse clean scans with complete production readiness. The high GHSA-vfj7-8cjw-p6xm in `braces` (transitive ESLint development tooling) has no published fix as of 2026-10-16: the CI enforces a production-only audit and reports the full audit as advisory, without treating that advisory as resolved. CSP hardening, attack-surface review and production deployment remain outstanding.
