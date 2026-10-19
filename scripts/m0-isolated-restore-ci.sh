#!/usr/bin/env bash
# Synthetic PostgreSQL 17 backup and restore across distinct throwaway servers.
# Never use production credentials, provider data or real Supabase archives.
set -euo pipefail
umask 077

source_container="${1:?CI source PostgreSQL container ID required}"
: "${GITHUB_RUN_ID:?GitHub Actions only}"
: "${RUNNER_TEMP:?Temporary runner directory required}"
restore_container="ff-restore-${GITHUB_RUN_ID}"
archive="${RUNNER_TEMP}/ff-m0-synthetic.dump"
cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
  rm -f -- "$archive"
}
trap cleanup EXIT

docker exec "$source_container" pg_dump -U postgres -d postgres -Fc \
  -n auth -n ff_private -n public -f /tmp/ff_m0_fixture.dump
docker cp "$source_container:/tmp/ff_m0_fixture.dump" "$archive"
source_hash="$(sha256sum "$archive" | cut -d ' ' -f1)"
test -n "$source_hash"

docker run --rm -d --name "$restore_container" \
  -e POSTGRES_PASSWORD=ci-only-postgres-password postgres:17
# Docker entrypoint's temporary init server accepts socket connections,
# then stops before the final PostgreSQL service starts. Probe TCP first:
# the temporary server has NO TCP listener, the final server does.
ready=0
for i in $(seq 1 40); do
  if docker exec "$restore_container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1 &&
     docker exec "$restore_container" psql -U postgres -d postgres -Atqc 'SELECT 1' 2>/dev/null | grep -qx '1'; then
    ready=1
    break
  fi
  sleep 1
done
test "$ready" -eq 1
docker exec "$restore_container" psql -U postgres -d postgres -At \
  -c 'show server_version_num' | grep -E '^17[0-9]{4}$'

# pg_dump of selected schemas does not export these external role globals.
docker exec "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c 'CREATE ROLE anon NOLOGIN'
docker exec "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c 'CREATE ROLE authenticated NOLOGIN'
docker cp "$archive" "$restore_container:/tmp/ff_m0_fixture.dump"
target_hash="$(docker exec "$restore_container" sha256sum /tmp/ff_m0_fixture.dump | cut -d ' ' -f1)"
test "$target_hash" = "$source_hash"

docker exec "$restore_container" createdb -U postgres ff_restore_ci
docker exec "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres -d ff_restore_ci \
  -c 'DROP SCHEMA public'
docker exec "$restore_container" pg_restore -U postgres --no-owner \
  --exit-on-error -d ff_restore_ci /tmp/ff_m0_fixture.dump
docker exec -i "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres \
  -d ff_restore_ci < database/tests/0004_restore_validation.sql

echo 'PASS: distinct PostgreSQL 17 instance, checksum and restored RLS/trigger/row invariants'
