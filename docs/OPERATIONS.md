# Operations

Daily sync, Friday forecast, Tuesday review, model training, staging/production jobs and callbacks are **disabled** at M0.

## Intended future cadence

Use Europe/Moscow; record actual start times and never assume GitHub cron executes exactly on time.
- Friday approx. 15:00 MSK: check official schedule, publish Zenit forecast *only* if a corresponding upcoming RPL fixture exists.
- Tuesday approx. 08:00 MSK: post-match audit *only* if a Zenit RPL match finished since last Tuesday.
- During international breaks, winter break, off-season, cancellations and other no-fixture periods: absolutely no empty/no-match notifications.

Do not substitute Cup/friendly fixtures. Machine JSON and Markdown exports must be versioned. ChatGPT delivery cannot be claimed without an implemented and tested connector/delivery mechanism.

Before production: design jobs table, idempotency, allowlisted dispatch, rate limits, trusted worker identity, safe callback/polling, retriable errors, artifact durability, quotas and operator authorization. Tests to verify restoring last good model and immutable forecast revisions.
