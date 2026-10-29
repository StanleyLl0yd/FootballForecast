# M1 verified Supabase PostgreSQL TLS

The manual-only FootballForecast M1 importer connects to the Frankfurt Supabase
Session pooler using `PGSSLMODE=verify-full` and the exact pooler host. The pooler
certificate chains to the **private Supabase Root 2021 CA**, which is not included
in Ubuntu's public operating-system trust store. Consequently
`PGSSLROOTCERT=system` failed with `DB_TLS` in the
[2026-10-29 protected import run](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/40941962616).

The public root certificate at
`security/certs/supabase-root-2021-ca.crt` is pinned by its **DER SHA-256**:

```text
807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa
```

This fingerprint matches the public root fingerprint documented in
[Supabase issue #50862](https://github.com/supabase/supabase/issues/50862).
The PEM bytes were cross-checked against independent public copies under
`mustafa-kara/project_auth` and `Micmyw/ez-image-ai`.
The certificate is *public*, never a password or service key.
Supabase's [official SSL configuration guidance](https://supabase.com/docs/guides/platform/ssl-enforcement)
requires the database root certificate for `verify-full`.

The protected workflow first hashes the pinned certificate **before secrets
are exposed**, then checks the exact same fingerprint again in the guarded
write step, checks certificate expiry and supplies it through a temporary
0600-only file referenced by `PGSSLROOTCERT`.
If `M1_PGROOTCERT_B64` is configured, it must decode to the same pinned
certificate. TLS identity and hostname verification remain mandatory.
No `sslmode=require`, `verify-ca` downgrade or connection hostname
override is permitted. SSL errors fail closed and cannot print DB passwords,
queries or licensed provider records.

To rotate the root CA, first obtain the new CA from
the Supabase project dashboard's Database Settings > SSL Configuration,
verify its identity independently, and change the pinned root and hash
through an audited protected PR. Do not silently trust a freshly downloaded
certificate or accept a new root merely because a network endpoint presented
it. Re-run synthetic tests and exact-main CI before a manual import.

This change does **not** imply that the live import has succeeded.
M1 remains OPEN until real staged records, hashes, source attribution, access
controls and model evaluation are independently verified.
