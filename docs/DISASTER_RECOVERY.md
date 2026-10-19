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


## Free offsite storage decision (candidate only, 2026-10-19)

**No provider selected or provisioned; owner approval and a real independent restore are outstanding.** Options were checked against vendor documentation, not an account-specific signup or billing quote.

| Option | Documented free allowance | European location | Constraint |
| --- | --- | --- | --- |
| [Backblaze B2](https://www.backblaze.com/cloud-storage) | 10 GB free; public signup advertises no card requirement | Select **EU Central (Amsterdam)** at account creation; [region is immutable](https://www.backblaze.com/docs/cloud-storage-data-regions) | Confirm quota, daily caps, API access and account limits after signup |
| [Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/) | 10 GB-month plus monthly operation allowances | Create bucket with explicit [EU jurisdiction](https://developers.cloudflare.com/r2/reference/data-location/), not a best-effort location hint | R2 [subscription checkout](https://developers.cloudflare.com/r2/get-started/) and potential charges above the allowance; no automatic zero-charge guarantee |

**Suggested decision: owner-controlled Backblaze B2 Free, EU Central**, if its real signup permits use without a payment method and no-cost quotas are sufficient. Reject or stop setup if payment, a paid commitment or an upgrade is required. Do not treat promotional "free" capacity as an enforceable no-cost limit; configure caps/alerts and account for retained old file versions. B2 region is selected at account creation, not per bucket. This is a candidate, not authorization to open an account, choose an ongoing retention policy or upload a dump.

### Minimum-safe production export architecture (not yet implemented)

1. Only run on reviewed/protected `main` through an explicit, secret-restricted GitHub Actions environment; never on forks, pull requests or arbitrary unreviewed code. Use PostgreSQL **17** client tools. For Supabase Free, direct database connection requires IPv6; when runner networking is IPv4-only, check the Supabase-provided **session pooler (port 5432)** rather than guessing a hostname or enabling paid IPv4. [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) and [backup guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
2. Agree on explicit `pg_dump` scope for application `public` and `ff_private` schemas, the necessary `auth` state, migration tracking, database roles/extensions, and separate Supabase Storage objects (if enabled). Document exclusions, role prerequisites and the restore order. A SQL dump alone does not capture Storage binary objects or externally configured secrets.
3. Encrypt **locally on the runner before upload** with a pinned, reviewed tool such as `age` using an **owner-held offline recovery private key** and a non-secret public recipient. No plaintext dumps, private decryption keys, connection strings or third-party provider records in logs, Actions artifacts, public Git or Vercel. The CI upload key is restricted to the private backup bucket/prefix and upload permissions only; a separate recovery key is stored offline. If temporary plaintext files are unavoidable, use isolated runner storage and trap cleanup on failure, without claiming secure erasure of the runner disk.
4. Upload immutable, date-stamped encrypted backup objects and a separately authenticated manifest recording archive SHA-256, size, PostgreSQL version, dump scope and timestamp. Verify remote readback/hash, not just a successful PUT. Keep past generations against accidental deletion or malicious replacement. If the upload credential has any delete permission, document why and add a separate retention control.
5. Restore **a real exported archive** using an independent read-only recovery credential and offline decryption key into a fresh, isolated, authorized PostgreSQL 17 instance; check row counts, table RLS, grants, FK indexes, archive triggers, restore errors and application read behavior. Never point a restore test at live Supabase. Keep raw production data out of CI artifacts and public reports.
6. Owner must accept actual **RPO**, **RTO**, schedule, retention, alerting and quota before automation. Capacity is the sum of retained encrypted backup generations, not the size of only the newest archive. Verify that recovery access works even if the Supabase project or GitHub repository is unavailable.

**Acceptance evidence:** successful production export time, offsite object identity/hash, location, encrypted retention, isolated restore log with sensitive data redacted, verified recovery time and the owner's accepted recovery policy. Until that exists, issue #5 and M0 stay **OPEN** regardless of CI fixture-restore results.

The public source repository and GitHub CI cannot by themselves guarantee recovery of the real Supabase Free database.
