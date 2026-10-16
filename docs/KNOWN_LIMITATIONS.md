# Known limitations - M0

- Public source is maintained on a protected `main` branch. CI, Security and CodeQL passed after the initial M0 PRs. No deployment or database instance is verified.
- A version 3 npm lockfile was generated and `npm ci` smoke-tested on a GitHub-hosted Node 22 runner; CI/Security now use `npm ci`. Remote web lint/typecheck/build previously passed; browser E2E and local registry access are still unavailable.
- Auth code prepared but not tested against real Supabase GitHub identities, callback allowlist, session expiry, or negative RLS policies.
- OAuth ownership check examines the verified GitHub provider identity `provider_id`/`sub`; this must be tested with real response shape before opening production access.
- Core Poisson accepts input intensities; it has not learned team strengths, calibrated outcomes, or produced actual match forecasts.
- No data ingestion permitted. Source catalog and usage rights require further verification.
- Database migration not applied. PostgreSQL tests and disaster recovery tests outstanding.
- `forecast-v1` is a partial contract; final exchange schema needs full probability/tail and audit fields.
- UI uses honest empty states; filters, charts, model jobs, match detail and reports are not yet implemented.
- Required checks run on pull requests and protected `main`; do not confuse clean scans with complete production readiness. The high GHSA-vfj7-8cjw-p6xm in `braces` (transitive ESLint development tooling) has no published fix as of 2026-10-16: the CI enforces a production-only audit and reports the full audit as advisory, without treating that advisory as resolved. CSP hardening, attack-surface review and production deployment remain outstanding.
