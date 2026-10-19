# Disaster recovery (M0)

The actual Supabase **Free** database is provisioned in Frankfurt (PostgreSQL 17) but the free plan does **not** include managed daily backups. **No live backup or restore has yet been demonstrated.** Do not treat CI fixtures as recoverable user/forecast data.

## Reproducible local restore exercise

The `python-core` CI job starts from a disposable PostgreSQL 17 database with synthetic M0 fixtures only. After migrations and RLS/append-only tests, it creates a custom-format `pg_dump -Fc` of `public`, `auth` and `ff_private`. It then **copies the archive to a distinct, newly started PostgreSQL 17 server container**, confirms source/staged copy SHA-256 agreement, provisions only the CI-only `anon`/`authenticated` NOLOGIN roles missing from a schema-only dump, restores into `ff_restore_ci` and executes `database/tests/0004_restore_validation.sql`. The assertions verify rows, access policies and grants, five integrity triggers, foreign-key indexes and archived forecast immutability.

This proves a **clean restore across two distinct PostgreSQL 17 server instances**, not merely two databases in one instance. Both containers still share the *same ephemeral GitHub runner*, so this is **not offsite retention, not cross-zone disaster recovery, not a production backup** and not proof that real Free Supabase data can be recovered independently. The synthetic dump is removed after verification and is never uploaded as an Actions artifact.

## Real REST role-refusal proof

The independent, **manually dispatched** public-key REST test is specified in [M0 REST Denial Proof](M0_REST_DENIAL_PROOF.md). It uses one allowed read and seven safe denied probes without inserting production data. Passing disposable PostgreSQL RLS tests is insufficient for the HTTP acceptance gate. This test is independent of the backup/restore gate below; neither proves the other.

## Production backup acceptance still required

Before loading valuable real data or moving to M1:
1. Define owner-approved Free-compatible export cadence, independent encrypted storage, least-privilege export credentials and key rotation. Never put backup passwords, raw football provider records or personal data in GitHub Actions artifacts or this public repository.
2. Select a secure, user-controlled destination outside the Supabase project; measure quota and retention without enabling paid features.
3. Make the backup restorable into a **separately isolated** authorized PostgreSQL 17 environment; test actual schema/RLS/trigger state, integrity checksums and row counts without exposing production data.
4. Record recovery point objective (RPO), recovery time objective (RTO), periodic restore schedule and recovery owner.
5. Include model hashes, raw source records (only where licenses permit), storage objects, forecast archive revisions and immutable publication timestamps. Failure must never rewrite the last-good ledger.

The public source repository and GitHub CI cannot by themselves guarantee recovery of the real Supabase Free database.
