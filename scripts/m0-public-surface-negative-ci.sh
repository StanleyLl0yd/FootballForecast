#!/usr/bin/env bash
# Disposable PostgreSQL 17 ONLY: prove the M0 public-surface attestation fails closed.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == 'true' && -n "${GITHUB_RUN_ID:-}" ]] || {
  echo 'This destructive negative fixture is GitHub Actions only' >&2
  exit 1
}
container="${1:?PostgreSQL CI container ID required}"
source_sql='database/tests/0007_live_public_surface.sql'
test -f "$source_sql"

# Each injected object is created inside a transaction deliberately aborted by
# the expected division-by-zero attestation failure. No rogue object persists.
for ddl in \
 'CREATE TABLE public.m0_unreviewed_table (id integer);' \
 'CREATE VIEW public.m0_unreviewed_view AS SELECT 1 AS id;' \
 'CREATE SEQUENCE public.m0_unreviewed_sequence;' \
 "CREATE FUNCTION public.m0_unreviewed_rpc() RETURNS integer LANGUAGE sql AS 'SELECT 1';"
do
  if output="$(
    { printf 'BEGIN;\\n%s\\n' "$ddl"; cat "$source_sql"; } |
      docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1
  )"; then
    echo 'ERROR: public surface drift was accepted' >&2
    exit 1
  fi
  if ! grep -q 'division by zero' <<< "$output"; then
    echo 'ERROR: negative drift case failed for an unexpected reason' >&2
    exit 1
  fi
done

# A new session must still see the exact allowed surface: aborted transactions
# cannot leave a fake leak, broken function or accidental DDL in restore fixtures.
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  < "$source_sql" >/dev/null
echo 'PASS: public surface drift denied for table, view, sequence and callable function'
