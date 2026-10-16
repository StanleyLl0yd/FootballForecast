# Known limitations - M0

- Public GitHub repository and draft PR #1 exist. Initial CI revealed lint problems and an unresolved transitive dev-tool advisory; fixes are under review. No deployment or database instance is verified.
- No npm lock. npm registry DNS failed in execution environment. Local typecheck, build and browser E2E remain unverified; remote CI is being exercised.
- Auth code prepared but not tested against real Supabase GitHub identities, callback allowlist, session expiry, or negative RLS policies.
- OAuth ownership check examines the verified GitHub provider identity `provider_id`/`sub`; this must be tested with real response shape before opening production access.
- Core Poisson accepts input intensities; it has not learned team strengths, calibrated outcomes, or produced actual match forecasts.
- No data ingestion permitted. Source catalog and usage rights require further verification.
- Database migration not applied. PostgreSQL tests and disaster recovery tests outstanding.
- `forecast-v1` is a partial contract; final exchange schema needs full probability/tail and audit fields.
- UI uses honest empty states; filters, charts, model jobs, match detail and reports are not yet implemented.
- Secret scanning and CodeQL have run on PR #1; exact-head final checks remain pending. The high GHSA-vfj7-8cjw-p6xm in `braces` (transitive ESLint development tooling) has no published fix as of 2026-10-16: the CI enforces a production-only audit and reports the full audit as advisory, without treating that advisory as resolved. Lockfile, CSP hardening, attack-surface review and production deployment remain outstanding.
