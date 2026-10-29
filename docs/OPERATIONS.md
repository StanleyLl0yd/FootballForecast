# Operations

Daily sync, Friday forecast, Tuesday review, model training, staging/production callbacks and privileged database writes remain **disabled** during M1 data-foundation work.

## M1 three-season source normalization (private and opt-in)

The [M1 Footbolno workflow](../.github/workflows/m1-footbolno-dataset.yml) tests offline parsing on PRs and, on a merged change to `main` or explicit manual `workflow_dispatch`, downloads the publisher's fixed free RPL CSV URL (max 2 MB), records UTC retrieval time and SHA-256, validates 2024/25, 2025/26 and 2026/27, and compares 2024/25 against the pinned OpenFootball CC0 source. The private normalized JSONL files are created with `0600` permissions inside an ephemeral `0700` runner directory, never uploaded, logged, committed, or imported into Supabase. Only aggregate QC, hashes and attribution appear in the job summary.

The current data contract keeps 2024/25 as `train_baseline`, 2025/26 as `sealed_holdout`, and 2026/27 as `current`. Each season requires 16 teams, 240 unique directed fixtures and valid IDs. Finished games require legal integer scores; cancelled, postponed, awarded, live, invalid or stale fixtures are quarantined. Unconfirmed kickoff times remain null, not fabricated midnight. Historical records have `publishedAtUtc: null`; downloading them today does not establish historical pre-match availability. Any QC failure fails the real-source job and blocks data promotion. Neither an ML model nor public forecasts are produced by this workflow.

Local private input, with the working directory outside the repository:

```bash
umask 077
mkdir -m 700 /tmp/ff-rpl-private
node scripts/m1-footbolno-normalize.mjs /tmp/footbolno.csv "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" /tmp/ff-rpl-private
```

The retrieval UTC argument must be the actual retrieval time, not a constructed historical publication date. Never commit the generated private files. Before persistent database ingestion, implement and review a non-browser authenticated write worker with a restricted role, transactionality, idempotence and source-provenance mapping; existing public RLS must remain unchanged. Source credit: [Footbolno CC BY 4.0](https://footbolno.ru/otkrytye-dannye) and [OpenFootball CC0](https://github.com/openfootball/europe). The same runner performs at most one free, competition-filtered SportScore UTC-day corroboration after unique RPL slug discovery, with a one-second spacing between API calls. Only aggregate agreement and response hash are printed, including a visible dofollow `Powered by SportScore` credit in the job summary. This is not ongoing polling, complete season coverage, a persistent SportScore mirror, or a public SportScore-backed UI; every future data surface must display the same attribution.


## Intended future cadence

Use Europe/Moscow; record actual start times and never assume GitHub cron executes exactly on time.
- Friday approx. 15:00 MSK: check official schedule, publish Zenit forecast *only* if a corresponding upcoming RPL fixture exists.
- Tuesday approx. 08:00 MSK: post-match audit *only* if a Zenit RPL match finished since last Tuesday.
- During international breaks, winter break, off-season, cancellations and other no-fixture periods: absolutely no empty/no-match notifications.

Do not substitute Cup/friendly fixtures. Machine JSON and Markdown exports must be versioned. ChatGPT delivery cannot be claimed without an implemented and tested connector/delivery mechanism.

Before production: design jobs table, idempotency, allowlisted dispatch, rate limits, trusted worker identity, safe callback/polling, retriable errors, artifact durability, quotas and operator authorization. Tests to verify restoring last good model and immutable forecast revisions.

## External production verification (M0)

The existing CI workflow runs a diagnostic `production-smoke` job from a GitHub-hosted runner, calling `https://footballforecast.vercel.app` without tokens. It checks HTTP health/security headers, public dashboard and matches pages, server-side anonymous Supabase REST connectivity (the dashboard's verified-data banner), protection of `/admin`, and public archive/data screens. Run locally with `npm run smoke:production` where the domain is reachable. **This job is non-gating** (`continue-on-error: true`), so a hosting outage does not make unrelated code PRs impossible to merge. Its outcome/logs must still be inspected before claiming production acceptance.

It is not a Russia-network reachability test, a browser UI E2E, an authenticated account test, an RLS write-attack test, or a guarantee that the deployment SHA matches the PR SHA. Confirm Vercel's deployed exact SHA independently. Never add a service role or provider-paid API credential to this smoke.

## Cross-browser diagnostics (M0)

An independent, non-gating `browser-compatibility` CI job exercises the published site with stable Firefox + Edge installed on the Ubuntu 24.04 runner, using Edge headless DOM/screenshot and native Firefox WebDriver/geckodriver. It checks public dashboard data, blocked `/admin` and mobile-sized screenshots. It runs without provider secrets and requires no browser npm packages. The result must be reviewed in workflow job logs. A diagnostic failure does not waive M0 browser acceptance and does not change six strict PR checks. Safari and connectivity from real Russian operators remain separate manual acceptance tests.

## macOS Safari browser diagnostic (M0)

The non-gating `safari-compatibility` job runs on a **standard** GitHub-hosted `macos-15` runner (free for public repositories). The job enables built-in stable Safari WebDriver with `sudo safaridriver --enable`, then uses pure Node WebDriver HTTP calls to verify the public dashboard, unauthenticated admin denial and a PNG screenshot. No Selenium/Playwright install, proprietary credentials, custom paid runner or user account. Failure remains visible and must be investigated before claiming Safari acceptance. Real ISP connectivity from Russia still requires separate testing.

### Chrome smoke reliability (2026-10-19)

On exact-main `336497252c03c89f19144ab2d3a1249a2fa85140` the required web job failed once because Google Chrome `--dump-dom` returned **empty stdout** despite a successful HTTP smoke and Next.js build. The test now retries **only** empty captures/timeouts, at most three launches, with independent browser profiles and local proxy disabled. Nonempty incorrect HTML remains an immediate hard failure; the check is still part of the required `web` job. This does not relax CI or substitute success based on the server-only HTTP checks. Inspect smoke logs if empty DOM recurs.

### Microsoft Edge blank-DOM diagnostic retry (2026-10-19)

The non-gating Edge/Firefox production browser job returned an empty `microsoft-edge --dump-dom` stdout twice (including exact-main CI 39221222354), though rerunning once succeeded and all required web/SQL/security checks passed. Chromium's hosted headless launches are now isolated by user-data directory; only a genuinely blank DOM or launch timeout may retry up to three times. Nonempty incorrect HTML fails immediately. The Edge mobile PNG and Firefox native WebDriver checks remain enforced within the diagnostic job; do not treat the diagnostic as passing unless job logs confirm success.


## M1 private PostgreSQL source staging (migration 0005)

After explicit migration review and production application, the server-only worker
`scripts/m1-stage-import.mjs` accepts the three 0600 private JSONL files and
`manifest.json` produced by the existing M1 normalizer. It checks exact source
SHA-256, all per-season SHA-256 values, 240 unique directed fixtures per season,
16 clubs, quarantines, score and temporal contracts. Its default invocation
**does not write**:

```bash
node scripts/m1-stage-import.mjs /private/manifest.json \
  /private/rpl-2024-2025.jsonl /private/rpl-2025-2026.jsonl \
  /private/rpl-2026-2027.jsonl
```

A genuinely privileged **server-only** PostgreSQL session can add `--commit`
after setting `FF_M1_DB_WRITE_ENABLED=1` and private standard PostgreSQL
connection environment variables `PGHOST`, `PGUSER`, `PGDATABASE`,
`PGPASSWORD`, `PGSSLMODE=verify-full`. Do not put any password, connection
URL or service-role secret in CLI arguments, source control, Next.js, browser
environment or public GitHub Actions. `PGSSLMODE=disable` is supported only
for localhost disposable tests. The worker uses a single bounded transaction,
checks source licensing metadata and reuses identical source-content hashes,
so repeated observations do not duplicate all 720 records and exceed Free
storage limits.

Only the private, RLS-enabled `ff_private.ff_ingest_snapshots` and
`ff_private.ff_ingest_matches` are written. Source observations are
append-only; unknown kickoff times remain NULL and historical
`published_at` remains NULL. There is no public match promotion, live model
fit or change to anonymous read permissions. A failed import must be
investigated and retried without bypassing hashes, quality checks or RLS.
Post-apply verification: inspect Supabase Security/Performance Advisors,
table grants, RLS, private record count, and the unchanged empty public
`ff_matches` table.

## Protected manual real-source import (M1)

Live Supabase Free `eu-central-1` migration `20261029162351_m1_private_source_staging`
has already been applied. The two private tables have RLS without any
browser-access policy by design; the four append-only triggers and anonymous
grant denial were verified live. No real matches were imported when the migration
was deployed. An intentional Supabase Security Advisor `INFO` about two
RLS-enabled/no-policy private tables is **not** an exposed-data vulnerability.

Run `M1 private Footbolno PostgreSQL import (manual only)` on the
**protected `main`** branch with the exact workflow input
`STAGE_FOOTBOLNO_PRIVATE`, **only after** configuring the GitHub Actions
environment `m1-source-import` (Repository Settings > Environments).
Its deployment branch rule must allow **only protected `main`**; require an
environment reviewer if supported. Do not put these secrets in repository-wide
Actions variables or the public web environment.

Create these **environment-scoped secrets** (the workflow never prints values):

| Name | Value |
| --- | --- |
| `M1_PGHOST` | Exact shared **Session pooler** hostname from Supabase Connect, matching `aws-[INDEX]-[REGION].pooler.supabase.com` (IPv4/port 5432). No direct host, IPv6-only endpoint, URL or transaction-pooler port. |
| `M1_PGUSER` | Exact FootballForecast tenant user `postgres.upulkesaiwnwfagjgteh` (other projects rejected). |
| `M1_PGDATABASE` | Database name must be exactly `postgres`. |
| `M1_PGPASSWORD` | Existing Supabase database password. Set directly in GitHub; never share in chat, scripts, screenshots or committed files. |
| `M1_PGROOTCERT_B64` | Optional base64 encoding of the Supabase database SSL root CA certificate (download privately from Supabase dashboard). Without it, `PGSSLROOTCERT=system` verifies against the runner's trusted CAs. |

A PowerShell 7 setup helper is available in
`scripts/Set-M1PrivateImportSecrets.ps1`. It creates the required
`m1-source-import` GitHub Environment with exactly one allowed deployment
branch, `main`, checks main branch protection, and prompts privately for
the four database connection values and optional Supabase CA PEM. It passes
secret values to the GitHub CLI through child-process stdin, never through
command-line arguments, plaintext files, terminal output or GitHub Actions
logs. It **does not** launch an import; verify that environment restrictions
and secret names exist before dispatch.

```powershell
$script = Join-Path $HOME 'Downloads/Set-M1PrivateImportSecrets.ps1'
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/StanleyLl0yd/FootballForecast/main/scripts/Set-M1PrivateImportSecrets.ps1' -OutFile $script
pwsh -NoProfile -File $script
```

The runner fixes `PGPORT=5432`, requires `PGSSLMODE=verify-full`,
downloads only the bounded fixed free Footbolno RPL CSV, runs the independent
720-record role/hash/time/score checks, then issues one atomic, content-hash
idempotent transaction against the private staging schema. No provider rows
or database credentials appear in logs, GitHub artifacts or public tables.
The job fails closed if any credential, source-quality or TLS prerequisite
is missing. GitHub Environment secret values cannot be verified by reading
the repository or rerunning public CI; the protected dispatch is the actual
connectivity verification.

After a green dispatch, independently confirm 1 private source snapshot,
240 matches per each of 3 seasons, 720 staged matches overall, unchanged
public match/forecast counts, RLS/grant denial and Supabase Security Advisor.
Keep future real snapshots append-only and stop on a quality drift: never
disable the temporal checks to get a green run. A secure private import alone
does not activate public results, historical leakage-free backtests or model
training.

### Target integrity (M1)

The offline importer refuses wrong Supabase tenant identifiers even when valid
PostgreSQL credentials are supplied. For production only the shared Session
pooler host, `postgres.upulkesaiwnwfagjgteh`, database `postgres`, port
`5432`, and verified TLS are accepted. The local PowerShell setup checks the
same destination **before** encrypting or saving any secret. A localhost bypass
exists solely for disposable tests and additionally requires
`FF_M1_LOCAL_TEST_ONLY=1`; this value must never be present in the protected
GitHub Actions job. The purpose is to prevent accidentally staging FootballForecast
data into a different project or a paid database.
