# Operations

Daily sync, Friday forecast, Tuesday review, model training, staging/production jobs and callbacks are **disabled** at M0.

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
