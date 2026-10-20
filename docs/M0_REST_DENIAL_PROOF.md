# Real anonymous REST authorization proof (M0)

Status: **prepared, not executed against production**. Issue [#5](https://github.com/StanleyLl0yd/FootballForecast/issues/5) remains open until the live proof succeeds and an independently restorable offsite backup is verified.

The additional read-only catalog attestation `database/tests/0007_live_public_surface.sql` verifies that schema `public` contains **exactly the nine reviewed M0 application relations** (all ordinary tables) and **exactly the four expected trigger-returning functions**, with no unexpected view, foreign table, sequence, materialized view or newly callable RPC function. The live catalog was verified on Frankfurt PostgreSQL 17 without touching application rows. Disposable PostgreSQL CI additionally creates unreviewed objects inside aborted transactions and requires this guard to reject each type. This guards against future **unexpected schema exposure** but is not an HTTP test, cannot prove PostgREST's configuration independently, and does not authorize a new public table or M1 migration. Any intentional schema expansion must undergo explicit review and update this exact allowlist alongside RLS/grant tests.

## No-terminal execution

1. In the GitHub repository's **Settings → Secrets and variables → Actions**, create repository secret `FF_SUPABASE_PUBLISHABLE_KEY` using only the **enabled modern publishable** key for the existing Frankfurt project, obtained directly in the [Supabase project API Keys page](https://supabase.com/dashboard/project/upulkesaiwnwfagjgteh/settings/api-keys). The value is a public-facing *publishable* key, not a service-role, secret or database password. Never put the key in a GitHub issue, pull request, code commit, screenshot or chat message.
2. After the reviewed PR is merged into `main`, open **GitHub → Actions → M0 Live REST Denial Proof → Run workflow**, select `main`. Nothing runs automatically or on a pull request.
3. Confirm the workflow reports 1 real anonymous `GET` returning HTTP 200 and seven **real REST denials** with PostgreSQL SQLSTATE `42501`, typically HTTP 401/403. Record the workflow run URL and exact `main` commit in issue #5.
4. A failure is actionable: investigate exact response classifications without changing RLS, widening grants, installing a service-role key or disabling the expected-denial assertions. Repeat only after reviewing the cause.

The request origin is pinned in code to `https://upulkesaiwnwfagjgteh.supabase.co`. No public user login is required, and the script never reads or logs the key. All requests have a 10-second timeout and refuse redirects.

## The eight requests and why they cannot change real data

| Method | Target | Expected |
| --- | --- | --- |
| GET | `ff_matches?select=id&limit=1` | HTTP 200, JSON array, at most one result |
| GET | `ff_sources?select=id&limit=1` | Denied 42501 |
| GET | `ff_source_records?select=id&limit=1` | Denied 42501 |
| GET | `ff_access_grants?select=user_id&limit=1` | Denied 42501 |
| POST | `ff_matches` with empty `{}` | Denied 42501; even erroneous GRANT cannot satisfy mandatory foreign keys |
| POST | `ff_forecasts` with empty `{}` | Denied 42501; even erroneous GRANT cannot satisfy mandatory non-null match/forecast fields |
| PATCH | `ff_matches` filtered to all-zero UUID | Denied 42501; filter does not target a real fixture |
| DELETE | `ff_forecasts` filtered to all-zero UUID | Denied 42501; filter does not target a real forecast |

The test **deliberately rejects** HTTP 200/204 on a supposed denied mutation, HTTP 400 validation errors, HTTP 404 table-not-found, unexpected error codes, invalid JSON, invalid keys, malformed responses and network failure. A superficial response without proof of SQL privilege refusal is not accepted. It sends no `Prefer: tx=rollback` header because no Supabase production setting guarantees rollback preference is honored.

Tests of this harness on normal CI are **local synthetic HTTP mocks only**, verifying fixed endpoints, empty POST bodies, nonmatching UUID filters, credential hygiene and fail-closed behavior. They are not advertised as real REST tests.

## Distinct gates still required

A successful REST HTTP run validates one actual anonymous publishable-key boundary at one moment. It is **not** a substitute for independent production logical backup and **isolated PostgreSQL 17 restoration**, real authenticated-user OAuth/authorization (deferred until enabled), legal match data acquisition, Russian carrier reachability or M0 acceptance.

See [Disaster recovery](DISASTER_RECOVERY.md) and [data-source decision register](DATA_SOURCES.md). Do not start M1 just because this single proof passes.
