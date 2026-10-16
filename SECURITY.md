# Security policy

M0 is not production-ready. Report vulnerabilities privately to the repository owner, not in public issues with secrets.

## Current controls

- Server-rendered routes enforce verified Supabase `getUser()` and match an immutable GitHub numeric provider ID through a pure negative-tested identity predicate. Blank configuration fails closed. Routes redirect to setup/login.
- No service-role key or vendor API credentials are used in any client component.
- Prepared Postgres RLS has no authenticated write policies. Forecast/outcome update and delete are rejected by triggers. **The migration has not been executed on a real database.**
- Next response headers deny framing and sniffing. Full nonce-based CSP, rate limits and cross-route authorization tests remain required.
- Secrets are prohibited in Git, runtime logs, fixtures, reports or external artifacts.
- Data import and remote job execution are disabled; no arbitrary shell execution exposed in UI.
- Actions are pinned to inspected full commit SHA. Initial exact-main CI, Security and CodeQL checks passed on GitHub.
- An active repository ruleset protects `main`: PR required, six GitHub Actions checks required and up-to-date, branch deletion and force push denied, no bypass accounts, zero mandatory approvals.

## Threats and remaining controls

- Unauthorized OAuth accounts: enforce stable provider ID server-side, test negative cases and session refresh in a real Supabase project.
- CSRF, redirect forgery and session fixation: OAuth uses Supabase PKCE; redirect is fixed, no user-provided callback URL. Verify in E2E. Add explicit origin checks for all future mutable endpoints.
- RLS/IDOR: enforce RLS for all SQL tables; test with viewer, operator, administrator and unassigned accounts against direct REST APIs.
- Supply chain: CI/Gitleaks/CodeQL run on pull requests and `main`; the production-dependency audit is enforced while the full developer dependency audit reports an unresolved upstream advisory. Use the committed npm lockfile and `npm ci` in CI for reproducible installs; continue reviewing transitive dependencies and Python packages.
- SSR auth response cache: all authorized pages are dynamic and the session-refreshing proxy marks responses private/no-store. Verify CDN caching on Vercel.
- Data source usage: no scraping FootyStats site or third-party copyrighted content without permission.
- Model artifact ingestion: untrusted pickle/joblib and executable files prohibited.
- Race and jobs: add server-side allowlist of job types, idempotency tokens, bounded concurrency and spending caps before activation.

No key, token, webhook signing secret, or service credential should ever be pasted into GitHub issues or chats.

Supabase M0 database contract: keep the `ff_is_authorized()` SECURITY DEFINER helper in the non-exposed `ff_private` schema and grant its execution only to `authenticated`. Public tables expose SELECT only to that role, with explicit browser-DML REVOKEs and row-level policies. These safeguards are continuously regression-tested against disposable PostgreSQL; actual Supabase API surface and grant state still require verification before production use.
