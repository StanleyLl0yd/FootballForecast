# Disaster recovery (M0)

The actual Supabase **Free** database is provisioned in Frankfurt (PostgreSQL 17) but the free plan does **not** include managed daily backups. **No live backup or restore has yet been demonstrated.** Do not treat CI fixtures as recoverable user/forecast data.

## M0 owner risk acceptance (2026-10-22)

The owner explicitly accepts the residual risk of **losing the current Free-project database with no independent production backup**. The full backup/restore decision is **deferred until FootballForecast is fully functional**, tracked in [issue #96](https://github.com/StanleyLl0yd/FootballForecast/issues/96). Real production backup/recovery is **not an M0 or M1 gate**. The risk is not zero; it becomes materially more consequential when valuable provider-approved rows or immutable forecasts are accumulated. Nothing here claims recoverability of Supabase Auth, Storage bytes, service configuration, credentials or actual production rows.

**Accepted replacement checks for M0:** (1) application migrations `0001`-`0003` executed from clean disposable PostgreSQL 17 and validated for RLS, grants, indexes and immutable triggers; (2) non-secret architecture, schema and Vercel/Supabase redeployment configuration recorded in GitHub (see [DEPLOYMENT](DEPLOYMENT.md)); (3) this explicit no-backup residual-risk acceptance. Latest matching [main CI #39764646186](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39764646186) passed application-schema replay and isolated **synthetic** encrypted PostgreSQL 17 restore. Live read-only SQL on 2026-10-22 returned **0** in `public.ff_matches`, `ff_forecasts`, `ff_source_records` and `ff_access_grants`. Only those four table counts were checked; do not infer the whole Supabase instance is empty. This acceptance replaces, rather than proves, real offsite disaster recovery.

## Reproducible local restore exercise

The `python-core` CI job starts from a disposable PostgreSQL 17 database with synthetic M0 fixtures only. After migrations and RLS/append-only tests, it creates a custom-format `pg_dump -Fc` of `public`, `auth` and `ff_private`. It then encrypts the **synthetic** dump locally with the externally vetted **age v1.3.2 Linux amd64 binary**, downloaded from the official immutable GitHub release and checked against the release asset SHA-256 `cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10`. A disposable encryption/recovery identity is generated in that CI run, with no key in code/logs/artifacts. It rejects a deliberately corrupted age ciphertext, then copies **only encrypted dump bytes** to a distinct, newly started PostgreSQL 17 container. Only there does it supply the ephemeral CI-only recovery identity, decrypt, verify the original plaintext SHA-256, provision missing CI `anon`/`authenticated` NOLOGIN roles, restore into `ff_restore_ci` and execute `database/tests/0004_restore_validation.sql`. The assertions verify rows, access policies and grants, five integrity triggers, foreign-key indexes and archived forecast immutability.

This proves a **cryptographically verified encrypted archive roundtrip and clean restore across two distinct PostgreSQL 17 server instances**, not merely two databases in one instance. Both containers still share the *same ephemeral GitHub runner*, so this is **not independently stored encrypted offsite data, not cross-zone disaster recovery, not an owner-held offline recovery identity, not a production backup** and not proof that real Free Supabase data can be recovered independently. The synthetic dump is removed after verification and is never uploaded as an Actions artifact.

## Real REST role-refusal proof

The independent, **manually dispatched** public-key REST test was actually **executed on 2026-10-22 and PASSED** on exact production `2d307fbf9159d063b3ee914c8cb65c64ec4a14a0`: [GitHub Actions run #39763464499/job #119773072854](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39763464499/job/119773072854). One real anonymous read returned HTTP 200, and all seven unauthorized requests returned HTTP 401 with tested PostgreSQL SQLSTATE `42501`; no live data modification. See [M0 REST Denial Proof](M0_REST_DENIAL_PROOF.md). **This is not a database backup or restore**: independent encrypted real-data recovery remains unproven and, by owner decision, does not block M0/M1.

## Deferred production backup/recovery decision (not an M0/M1 gate)

When FootballForecast is fully functional and the owner chooses to revisit backups (#96), consider:
1. Define owner-approved Free-compatible export cadence, independent encrypted storage, least-privilege export credentials and key rotation. Never put backup passwords, raw football provider records or personal data in GitHub Actions artifacts or this public repository.
2. Select a secure, user-controlled destination outside the Supabase project; measure quota and retention without enabling paid features.
3. Make the backup restorable into a **separately isolated** authorized PostgreSQL 17 environment; test actual schema/RLS/trigger state, integrity checksums and row counts without exposing production data.
4. Record recovery point objective (RPO), recovery time objective (RTO), periodic restore schedule and recovery owner.
5. Include model hashes, raw source records (only where licenses permit), storage objects, forecast archive revisions and immutable publication timestamps. Failure must never rewrite the last-good ledger.


## Free offsite storage decision (candidate only, 2026-10-19)

**No provider selected or provisioned; backup decision deferred to #96.** The historical candidates below have not been reconfirmed for current pricing or onboarding. Do not register accounts or enable billing for M0/M1.

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

**Future production-backup evidence (only if the owner elects to implement it):** successful production export time, offsite object identity/hash, location, encrypted retention, isolated restore log with sensitive data redacted, verified recovery time and an owner-approved recovery policy. These checks are **not** required for M0/M1 under the accepted risk. An absence of backup is a loss-of-data risk, not proof that recovery would work.

The public source repository and GitHub CI cannot by themselves guarantee recovery of the real Supabase Free database.


## Owner-operated, local encrypted export tool (prepared, NOT production-tested)

The manual-only `scripts/m0-manual-encrypted-export.sh` streams `pg_dump -Fc` directly into `age v1.3.2`; no plaintext dump is saved locally. It refuses CI, malformed/incomplete connection configuration, anything weaker than `PGSSLMODE=verify-full`, non-5432 transaction-pooling connections, non-PostgreSQL 17 client/server versions and failed dump/encryption pipelines. It additionally rejects output paths inside the repository checkout to reduce accidental Git inclusion. Its local output is one private directory containing `database.pg17.dump.age` and `manifest.txt` with ciphertext SHA-256, byte count and UTC timestamp. Nothing uploads automatically; the manifest SHA-256 is **not** an authenticated remote tamper-evidence signature.

An authorized owner must install and independently verify the official `age v1.3.2` executable and PostgreSQL 17 command-line clients on a trusted Linux machine; generate/store the decryption identity **offline**, separate from the future storage account, and supply its **public** `age1...` recipient. Use a private `PGPASSFILE` outside Git (preferred; mode 0600), or a process-environment password without putting it in shell history or arguments. In the Supabase **Connect** panel choose the **direct IPv6, port 5432** connection for a machine with IPv6, or the **session pooler, port 5432** on IPv4-only networks (not the transaction pooler on 6543). Set `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPORT=5432`, `PGSSLMODE=verify-full` and the correct trusted server CA configuration. Use only a credential approved for read/export, never the public publishable API key.

Manual command after securely configuring the above environment (illustrative, no credentials):

```sh
export FF_AGE_RECIPIENT='age1...public-recipient-from-offline-key'
export FF_BACKUP_OUTPUT_DIR='/private/offline-backups'
bash scripts/m0-manual-encrypted-export.sh
```

**Important limits:** only schema/data in `public`, `ff_private` and `auth` are exported; this is **not** a full Supabase instance archive. Cluster roles, Supabase-managed settings/extensions, external credentials and actual Storage object bytes are excluded; an isolated restore needs documented role/extension prerequisites and separate permitted objects. The operator must check `pg_dump` output/coverage, storage quota, source rights and actual archive restorability. Move the encrypted archive and manifest to an approved independent $0 destination, record the expected checksum **outside that destination**, verify a complete remote download/hash, and restore into a separately isolated PostgreSQL 17 environment with owner-held recovery key. Do not upload plaintext, a decryption identity or passwords. Do not run an initial real export before choosing the authorized scope, credential and recovery location.

This script and its synthetic mocks alone do **not** demonstrate production recovery. Under the 2026-10-22 owner decision, production backup/recovery is deferred to #96 and no longer gates issue #5, M0 or M1.


## Owner-operated offline independent restore rehearsal (prepared; NOT production-tested)

The new companion [`scripts/m0-manual-isolated-restore.sh`](../scripts/m0-manual-isolated-restore.sh) validates a **previously exported** encrypted bundle, restores it into a **disconnected, temporary local PostgreSQL 17 Docker container**, then runs three read-only live-schema/RLS/immutable-ledger attestations (`0005`, `0006`, `0007`). This is not a full Supabase service clone or an alternative to a real offsite backup.

### Security and prerequisites

**Docker locality gate (2026-10-21):** Docker's `--network none` protects only the **container network**, not the connection between Docker CLI and Docker daemon. If the operator's Docker context is `ssh://`/`tcp://`, `docker cp` would send decrypted database rows to a remote server despite `--network none`. The restore utility now requires the actual `default` context with endpoint exactly `unix:///var/run/docker.sock`, a present local Unix socket, and refuses `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_TLS_VERIFY`, or `DOCKER_CERT_PATH` overrides **before decrypting any archive**. On rootless Docker, Docker Desktop, an SSH/TCP context, or a custom Unix socket, it intentionally refuses to run. Use a trusted dedicated Linux machine with the standard local Docker Engine; do not bypass the guard or reconfigure it to target a remote host. This check limits common accidental remote routing but cannot attest a malicious socket proxy, compromised engine, or host filesystem. This precondition follows Docker's [documented context and environment override behavior](https://docs.docker.com/engine/manage-resources/contexts/).

- Run only on a **trusted, independently operated Linux recovery host**, with Docker, verified age v1.3.2, `sha256sum`, `findmnt`, and sufficiently large RAM-backed `/dev/shm`. The trusted official `postgres:17` Docker image must **already be cached locally**. The script uses `--pull never --network none` with **no published ports**. It never downloads an image or connects to production. The container's trust-only authentication is acceptable **only inside this disconnected, ephemeral instance**; never use this authentication mode on a networked PostgreSQL server.
- Retrieve `database.pg17.dump.age` and `manifest.txt` from the user-approved offsite destination via an independently authorized account. The source PostgreSQL password is not needed on this machine.
- Provide a **trusted, independently recorded SHA-256** from outside the archive's storage account. The on-bucket manifest is not signed. The script requires `FF_EXPECTED_CIPHERTEXT_SHA256` to match BOTH the manifest and encrypted file, validates exact format/scope and checks the recovery private-key file permissions. An age ciphertext proves decryption integrity, **not sender identity**: an attacker could encrypt a forged dump to the public recipient, so the separately trusted hash matters.
- Supply the owner-held age identity on the recovery host only. Never share it with the storage account, GitHub, CI, Supabase, Vercel or ChatGPT.
- Decrypt completely to owner-private `/dev/shm` **before** executing archive SQL. The temporary plaintext custom dump then briefly enters the **offline Docker container**, whose writable layer may use host disk. Use a trusted encrypted recovery host. Cleanup removes RAM plaintext, the Docker container **and its anonymous PostgreSQL data volumes** (`docker run --rm` plus `docker rm -fv` on exit), **not provable secure erase**.
- Supabase Auth may require roles/extensions not included in a schema-scoped dump. The helper provisions common NOLOGIN roles and `extensions.pgcrypto` / `extensions."uuid-ossp"` (both observed on live Frankfurt PG17 on 2026-10-21), but it must **fail** instead of skipping ACLs, force-restoring partial data, disabling RLS, or silently ignoring missing dependencies. Correct any additional prerequisite in a separate reviewed recovery plan.
- The three read-only M0 catalog/ledger checks are not data-row accuracy checks or a complete Supabase recovery. Additional private row counts, Storage objects if enabled, application read behaviour and operator-approved RPO/RTO are independently required. A local restore without actual offsite retrieval does **not** close #5.

### Manual command on the independent recovery host

```sh
export FF_RESTORE_BUNDLE_DIR='/private/recovered-offsite/ff-pg17-...'
export FF_AGE_IDENTITY_FILE='/private/offline-owner-age-identity'
export FF_EXPECTED_CIPHERTEXT_SHA256='64-lowercase-hex-digits-from-separate-trusted-record'
bash scripts/m0-manual-isolated-restore.sh
```

On success record **only redacted evidence** privately: authorized independent storage object ID and checked hash, retrieval/restore timestamps, PostgreSQL version, results of all three SQL attestations, recovered-data private checks and measured recovery time. Do not publish archive bytes, personal data or recovery keys. **No real database archive has yet been tested** with this script; synthetic fail-closed mocks do not satisfy #5.
