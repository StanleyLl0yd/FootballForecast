# Security policy

M0 is not production-ready. Report vulnerabilities privately to the repository owner, not in public issues with secrets.

## Current controls

- Server-rendered routes enforce verified Supabase `getUser()` and match an immutable GitHub numeric provider ID. Blank configuration fails closed. Routes redirect to setup/login.
- No service-role key or vendor API credentials are used in any client component.
- Prepared Postgres RLS has no authenticated write policies. Forecast/outcome update and delete are rejected by triggers. **The migration has not been executed on a real database.**
- Next response headers deny framing and sniffing. Full nonce-based CSP, rate limits and cross-route authorization tests remain required.
- Secrets are prohibited in Git, runtime logs, fixtures, reports or external artifacts.
- Data import and remote job execution are disabled; no arbitrary shell execution exposed in UI.
- Actions are pinned to inspected full tag commit SHA; not yet exercised on GitHub.

## Threats and remaining controls

- Unauthorized OAuth accounts: enforce stable provider ID server-side, test negative cases and session refresh in a real Supabase project.
- CSRF, redirect forgery and session fixation: OAuth uses Supabase PKCE; redirect is fixed, no user-provided callback URL. Verify in E2E. Add explicit origin checks for all future mutable endpoints.
- RLS/IDOR: enforce RLS for all SQL tables; test with viewer, operator, administrator and unassigned accounts against direct REST APIs.
- Supply chain: verify transitive dependencies, generate npm lock, run npm audit and Python dependency checks. Run authored Gitleaks v3 and npm audit workflows, and protect main; CodeQL is eligible for the public repository; configure and verify its workflows before claiming coverage.
- SSR auth response cache: all authorized pages are dynamic and the session-refreshing proxy marks responses private/no-store. Verify CDN caching on Vercel.
- Data source usage: no scraping FootyStats site or third-party copyrighted content without permission.
- Model artifact ingestion: untrusted pickle/joblib and executable files prohibited.
- Race and jobs: add server-side allowlist of job types, idempotency tokens, bounded concurrency and spending caps before activation.

No key, token, webhook signing secret, or service credential should ever be pasted into GitHub issues or chats.
