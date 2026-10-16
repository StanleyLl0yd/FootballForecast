# Data schema

M0 migration `database/migrations/0001_foundation.sql` defines the first thin operational subset: authorization grants, sources, competitions, seasons, teams, matches, source records, forecasts and outcomes. The full schema from the specification (players, coaches, venues, events, per-player/team stats, source ID mapping, snapshots, jobs, training runs and model registry) belongs to M1–M4.

External vendor IDs must not be used as internal primary keys. `source_records` stores vendor ID and payload SHA-256 without automatically treating it as a historically available record. `ff_matches.status` distinguishes incomplete, postponed and awarded matches. Forecasts have unique `(match_id, revision)`, DB-level live-publication cutoff (including server clock checks) and append-only triggers. Backtests must be kept in distinct tables, never inserted into the live forecast journal. Post-match outcomes are written separately. Hash-format checks alone are not cryptographic attestation of actual dataset contents.

Before production: add first-class snapshot/revision links, immutable archive backups, match final-result integrity checks, full probability-distribution validation at publication, and provider-ID mapping. Test migrations on a disposable PostgreSQL with negative RLS access tests.
