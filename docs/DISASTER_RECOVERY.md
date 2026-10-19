# Disaster recovery (M0)

The actual Supabase **Free** database is provisioned in Frankfurt (PostgreSQL 17) but the free plan does **not** include managed daily backups. **No live backup or restore has yet been demonstrated.** Do not treat CI fixtures as recoverable user/forecast data.

## Reproducible local restore exercise

The existing `python-core` CI job uses a disposable PostgreSQL 17 container and synthetic M0 fixtures only. After applying the three migrations and testing RLS/append-only guards, CI exports `public`, `auth` and `ff_private` schemas plus fixture rows to a custom-format `pg_dump` file, restores it into a newly created `ff_restore_ci` database on the same isolated container, then runs `database/tests/0004_restore_validation.sql`. The assertions verify rows, access rules, policies, five integrity triggers, indexes and archived forecast immutability.

This proves a **PostgreSQL 17 test-fixture database round trip on the same major release as production**, not a production backup, not an independent-zone recovery and not a true externally stored restore.

## Production backup acceptance still required

Before loading valuable real data or moving to M1:
1. Define owner-approved Free-compatible export cadence, independent encrypted storage, least-privilege export credentials and key rotation. Never put backup passwords, raw football provider records or personal data in GitHub Actions artifacts or this public repository.
2. Select a secure, user-controlled destination outside the Supabase project; measure quota and retention without enabling paid features.
3. Make the backup restorable into a **separately isolated** authorized PostgreSQL 17 environment; test actual schema/RLS/trigger state, integrity checksums and row counts without exposing production data.
4. Record recovery point objective (RPO), recovery time objective (RTO), periodic restore schedule and recovery owner.
5. Include model hashes, raw source records (only where licenses permit), storage objects, forecast archive revisions and immutable publication timestamps. Failure must never rewrite the last-good ledger.

The public source repository and GitHub CI cannot by themselves guarantee recovery of the real Supabase Free database.
