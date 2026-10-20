#!/usr/bin/env bash
# M0 real PostgREST HTTP checks against ONLY the disposable GitHub CI Postgres.
# No Supabase key, live database URL, migration, real provider row or external API.
set -euo pipefail
postgres_container="${1:?usage: bash scripts/m0-disposable-postgrest-ci.sh POSTGRES_CONTAINER_ID}"
postgrest_container="ff-m0-postgrest-${GITHUB_RUN_ID:-local}"
cleanup() { docker rm -f "$postgrest_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Non-production authentication role (no inherited grants or admin rights).
docker exec -i "$postgres_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
CREATE ROLE ff_ci_postgrest LOGIN PASSWORD 'ci-only-http-password' NOINHERIT;
GRANT anon TO ff_ci_postgrest;
SQL

# PGRST_DB_TX_END=rollback provides an additional CI-only fail-safe against
# accidental writes, regardless of mistakes in the RLS/GRANT fixtures.
# Host networking is restricted to an ephemeral, hosted GitHub runner.
docker run --detach --rm --network host \
  --name "$postgrest_container" \
  --env PGRST_DB_URI='postgresql://ff_ci_postgrest:ci-only-http-password@127.0.0.1:5432/postgres' \
  --env PGRST_DB_ANON_ROLE=anon \
  --env PGRST_DB_SCHEMAS=public \
  --env PGRST_DB_TX_END=rollback \
  --env PGRST_SERVER_HOST=127.0.0.1 \
  --env PGRST_SERVER_PORT=3000 \
  postgrest/postgrest:v14.14 >/dev/null

ready=0
for i in $(seq 1 40); do
  code="$(curl --silent --output /dev/null --max-time 2 \
    --write-out '%{http_code}' 'http://127.0.0.1:3000/ff_matches?select=id&limit=0' || true)"
  if [ "$code" = '200' ]; then
    ready=1
    break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$postgrest_container" 2>/dev/null || true)" != true ]; then
    echo 'Disposable PostgREST container exited during startup' >&2
    exit 1
  fi
  sleep 0.5
done
test "$ready" -eq 1
node scripts/m0-disposable-postgrest.mjs
echo 'PASS: actual HTTP anonymous read/denials against isolated PostgREST and synthetic PostgreSQL 17'
