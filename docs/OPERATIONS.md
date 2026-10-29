# Operations

Daily sync, Friday forecast, Tuesday review, model training, staging/production callbacks and privileged database writes remain **disabled** during M1 data-foundation work.

## M1 three-season source normalization (private and opt-in)

The [M1 Footbolno workflow](../.github/workflows/m1-footbolno-dataset.yml) tests offline parsing on PRs and, on an explicit manual \`workflow_dispatch\`, downloads the publisher's fixed free RPL CSV URL (max 2 MB), records UTC retrieval time and SHA-256, validates 2024/25, 2025/26 and 2026/27, and compares 2024/25 against the pinned OpenFootball CC0 source. The private normalized JSONL files are created with \`0600\` permissions inside an ephemeral \`0700\` runner directory, never uploaded, logged, committed, or imported into Supabase. Only aggregate QC, hashes and attribution appear in the job summary.

The current data contract keeps 2024/25 as \`train_baseline\`, 2025/26 as \`sealed_holdout\`, and 2026/27 as \`current\`. Each season requires 16 teams, 240 unique directed fixtures and valid IDs. Finished games require legal integer scores; cancelled, postponed, awarded, live, invalid or stale fixtures are quarantined. Unconfirmed kickoff times remain null, not fabricated midnight. Historical records have \`publishedAtUtc: null\`; downloading them today does not establish historical pre-match availability. Any QC failure fails the manual run and blocks data promotion. Neither an ML model nor public forecasts are produced by this workflow.

Local private input, with the working directory outside the repository:

\`\`\`bash
umask 077
mkdir -m 700 /tmp/ff-rpl-private
node scripts/m1-footbolno-normalize.mjs /tmp/footbolno.csv 2026-10-29T15:00:00Z /tmp/ff-rpl-private
\`\`\`

The third argument must be the actual retrieval UTC time, not a constructed historical publication date. Never commit the generated private files. Before persistent database ingestion, implement and review a non-browser authenticated write worker with a restricted role, transactionality, idempotence and source-provenance mapping; existing public RLS must remain unchanged. Source credit: [Footbolno CC BY 4.0](https://footbolno.ru/otkrytye-dannye) and [OpenFootball CC0](https://github.com/openfootball/europe). SportScore current-event corroboration still requires its documented bounded request path and visible dofollow \`Powered by SportScore\` credit wherever the sourced data is displayed.


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
