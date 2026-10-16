# Proposed GitHub issues (create only after checking for duplicates)

Create as M0 issues after repository creation; avoid duplicate issues if GitHub already has these identifiers.

1. **M0: verify RPL source licenses and historical availability** - exact seasons, TOS, access rights, date semantics; decision register; no scraping.
2. **M0: lock dependencies and validate full web build** - npm lockfile, lint, typecheck, npm audit, Next production build, responsive browser smoke.
3. **M0: connect Supabase OAuth and test owner-only authorization** - immutable GitHub ID, negative-login and direct-route tests, session refresh.
4. **M0: apply data schema and prove RLS/append-only constraints** - migration, rollback strategy, SQL integration, unauthorized REST tests.
5. **M0: deploy to Vercel and verify production** - monorepo path, no-store, OAuth callbacks, health, browsers, failure handling.
6. **M0: enable repository protections and complete CI/security** - pinned actions, CodeQL eligibility, secret scanning, exact-head and post-merge.

Leave milestone M0 open until all are independently verified. M1 is not approved while any M0 acceptance criterion remains unmet.
