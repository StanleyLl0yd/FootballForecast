# Known limitations - M0

- The public, anonymous read-only prototype is deployed to Vercel Hobby, functions in Frankfurt; GitHub-hosted HTTP smoke verified the live site and the server-side Supabase REST read. **Access from Russian ISPs without VPN is not measured**. No commercial hosting is approved.
- Supabase Free PostgreSQL 17 in Frankfurt has three applied migrations and nine RLS tables. Six are anonymous SELECT-only; source rights, raw records and access grants remain private. The real database is empty, so there are no licensed RPL matches, model results or forecasts.
- Reproducible npm lockfile and `npm ci`, GitHub CI/Security/CodeQL, disposable PostgreSQL RLS tests, Node HTTP tests, and headless Chrome smoke pass. Safari/Firefox/Edge, real Supabase Free PostgreSQL 17 backup/recovery and real GitHub OAuth lifecycle tests are not yet demonstrated (synthetic pg_dump/pg_restore is exercised in CI).
- Accounts are intentionally deferred. The optional owner-only OAuth route remains fail-closed and administrative mutations are disabled. Do not require owner login for ordinary public pages or claim operational admin access.
- Python Poisson primitives accept input intensities but have not learned strengths, been calibrated or passed real historical backtests. Data sources lack final rights approval: **no scraping, import, paid feed or fabricated fixtures**.
- Evaluation and model contracts are partial; filters, detailed match predictions, independently validated charts and user profiles are not yet implemented. Publication/temporal-integrity guards are in SQL, but a functioning authorized prediction worker and backup/restore acceptance remain future work.
- An unresolved high-severity advisory in transitive ESLint development dependency `braces` (GHSA-vfj7-8cjw-p6xm) is tracked in issue #8; enforced production-only audit is clean, full dev audit is advisory pending upstream fix. CSP hardening and external security review remain open.
- Vercel deployment status and canary success do not establish availability under Russian operator filtering, future scalability or legality of storage/processing for possible future Russian user accounts.

M0 remains OPEN. M1 may not start until the owner accepts M0.
