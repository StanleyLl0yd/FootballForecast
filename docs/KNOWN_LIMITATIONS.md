# Known limitations - M0

- No remote GitHub repository, PR, actual CI run, deployment URL or database instance yet verified.
- No npm lock. npm registry DNS failed in execution environment. Typecheck, frontend lint/build and browser E2E were not executed.
- Auth code prepared but not tested against real Supabase GitHub identities, callback allowlist, session expiry, or negative RLS policies.
- OAuth ownership check examines the verified GitHub provider identity `provider_id`/`sub`; this must be tested with real response shape before opening production access.
- Core Poisson accepts input intensities; it has not learned team strengths, calibrated outcomes, or produced actual match forecasts.
- No data ingestion permitted. Source catalog and usage rights require further verification.
- Database migration not applied. PostgreSQL tests and disaster recovery tests outstanding.
- `forecast-v1` is a partial contract; final exchange schema needs full probability/tail and audit fields.
- UI uses honest empty states; filters, charts, model jobs, match detail and reports are not yet implemented.
- Security workflows are authored (Gitleaks v3 / npm audit), but have never run. Private personal GitHub repositories cannot enable CodeQL code scanning without an eligible security plan. Lockfile, CSP hardening, attack-surface review and repeatable production deployment remain outstanding.
