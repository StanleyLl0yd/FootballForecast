# M0 verification snapshot - 2026-10-16

## Confirmed locally

- Python tests: 21 passed (`python -m pytest ml/tests -q`).
- Python source byte compilation: PASS.
- TS/TSX syntax transcription check via TypeScript `transpileModule`: PASS for 23 source files (typechecking unavailable without dependencies).
- JSON manifests and forecast schema parse/validate: PASS.
- CI/Dependabot/Security YAML syntax: PASS.
- Third-party Actions in workflows pinned to verified Git commit hashes.
- Source coverage and terms investigated through vendor documentation; approvals remain pending.

## Not checked / blocked

- Repo `StanleyLl0yd/FootballForecast`: absent, no remote HEAD or issues, PR or CI run.
- npm registry unavailable from execution environment (`EAI_AGAIN`); no package lock, production build, eslint, actual TypeScript typechecking or npm audit result.
- Ruff unavailable locally; syntax/pytest only.
- No Supabase project: SQL DDL, triggers, negative RLS policies, OAuth and E2E unexecuted.
- No Vercel deployment or browser compatibility runs.
- No historical data approved for automated ingestion; no fitted models, backtests, calibration or real forecasts.

M0 remains OPEN. This is not a production readiness or independent model accuracy report.


## Follow-up on GitHub (2026-10-16)

The initial pre-publication status above is a preserved historical snapshot, **not the current repository state**.

- GitHub repository is public; `main` is protected by active ruleset #25266406. Initial and subsequent exact-main CI, Security and CodeQL succeeded before this update.
- The workspace npm lockfile was generated with Node 22 on a GitHub-hosted runner (M0 bootstrap run `38957204205`). The runner completed `npm ci --ignore-scripts` successfully.
- Permanent CI and Security now use `npm ci` and the checked-in dependency lock; exact-head and post-merge test evidence must be checked on the associated PR.
- Authentication against real Supabase users, migration/RLS integration, authorized football-data access, cross-browser testing and deployment remain incomplete. M0 is **OPEN**.
