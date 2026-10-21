#!/usr/bin/env bash
# Manual, operator-only offline recovery rehearsal of an encrypted M0 PG17 export.
# Never contacts Supabase or other remote DBs. No CI, upload or image pulling.
set -euo pipefail
umask 077
fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || fail 'manual execution only: CI forbidden'
[[ -n "${FF_RESTORE_BUNDLE_DIR:-}" && -n "${FF_AGE_IDENTITY_FILE:-}" &&
   -n "${FF_EXPECTED_CIPHERTEXT_SHA256:-}" ]] ||
  fail 'bundle, offline age identity and independently recorded SHA-256 required'
[[ "$FF_EXPECTED_CIPHERTEXT_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid expected SHA-256'
[[ -d "$FF_RESTORE_BUNDLE_DIR" && ! -L "$FF_RESTORE_BUNDLE_DIR" ]] ||
  fail 'bundle directory must exist and not be a symlink'
[[ -f "$FF_AGE_IDENTITY_FILE" && ! -L "$FF_AGE_IDENTITY_FILE" &&
   -r "$FF_AGE_IDENTITY_FILE" ]] || fail 'offline age identity must be a readable non-symlink file'
for binary in docker age sha256sum findmnt mktemp stat; do
  command -v "$binary" >/dev/null 2>&1 || fail "missing executable: $binary"
done
[[ "$(age --version)" == 'age v1.3.2' ]] || fail 'verified age v1.3.2 required'
identity_mode="$(stat -c %a "$FF_AGE_IDENTITY_FILE")"
[[ "$identity_mode" =~ ^[0-7]{3,4}$ ]] || fail 'invalid identity file permissions'
(( (8#$identity_mode & 077) == 0 )) || fail 'offline age identity accessible to group/others'
[[ -d /dev/shm && "$(findmnt -n -o FSTYPE --target /dev/shm)" == 'tmpfs' ]] ||
  fail '/dev/shm must be tmpfs; recovery plaintext must not be placed on local disk'

bundle="$(cd -- "$FF_RESTORE_BUNDLE_DIR" && pwd -P)"
archive="$bundle/database.pg17.dump.age"
manifest="$bundle/manifest.txt"
[[ -f "$archive" && ! -L "$archive" && -f "$manifest" && ! -L "$manifest" ]] ||
  fail 'missing or symlinked encrypted archive/manifest'
declare -A fields=()
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  [[ "$key" =~ ^[a-z0-9_]+$ && -n "$value" && -z "${fields[$key]+x}" ]] ||
    fail 'malformed/duplicate manifest field'
  case "$key" in
    format|created_utc|scope|archive|ciphertext_sha256|ciphertext_bytes|excluded) ;;
    *) fail 'unexpected manifest field' ;;
  esac
  fields["$key"]="$value"
done < "$manifest"
[[ "${#fields[@]}" == 7 ]] || fail 'manifest missing required fields'
[[ "${fields[format]}" == 'postgres-custom-pg17-age-v1.3.2' &&
   "${fields[scope]}" == 'public,ff_private,auth' &&
   "${fields[archive]}" == 'database.pg17.dump.age' &&
   "${fields[excluded]}" == 'global_roles,instance_config,external_secrets,storage_object_bytes' ]] ||
  fail 'unexpected archive format, scope or exclusions'
[[ "${fields[created_utc]}" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z$ ]] ||
  fail 'invalid backup creation timestamp'
[[ "${fields[ciphertext_sha256]}" == "$FF_EXPECTED_CIPHERTEXT_SHA256" ]] ||
  fail 'manifest disagrees with independently recorded SHA-256'
[[ "${fields[ciphertext_bytes]}" =~ ^[1-9][0-9]*$ ]] || fail 'invalid ciphertext length'
[[ "$(wc -c < "$archive" | tr -d ' ')" == "${fields[ciphertext_bytes]}" ]] ||
  fail 'ciphertext size mismatch'
actual_hash="$(sha256sum "$archive" | cut -d ' ' -f1)"
[[ "$actual_hash" == "$FF_EXPECTED_CIPHERTEXT_SHA256" ]] ||
  fail 'ciphertext hash mismatch; refuse decryption'
# The image MUST already be present; do not fetch or pull anything.
docker image inspect postgres:17 >/dev/null ||
  fail 'locally cached postgres:17 image required; no automatic download'
temp="$(mktemp -d /dev/shm/ff-m0-recovery.XXXXXXXX)"
container="ff-m0-restore-${temp##*.}"
started=0
cleanup() {
  if [[ "$started" == 1 ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$temp"
}
trap cleanup EXIT
# Fully authenticate encrypted archive before any SQL can be executed.
# Only private tmpfs holds a transient local plaintext copy. Docker will get
# its own short-lived copy (removed with the disconnected container).
age --decrypt --identity "$FF_AGE_IDENTITY_FILE" \
  --output "$temp/restore.dump" "$archive" ||
  fail 'archive decryption or integrity verification failed'
[[ -s "$temp/restore.dump" ]] || fail 'decrypted archive is empty'
docker run --pull never -d --name "$container" --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null ||
  fail 'cannot start isolated offline PostgreSQL 17 container'
started=1
ready=0
for _ in $(seq 1 45); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d postgres >/dev/null 2>&1; then
    ready=1; break
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || fail 'isolated PostgreSQL 17 startup timeout'
server_version="$(docker exec "$container" psql -X -U postgres -d postgres -Atqc 'SHOW server_version_num')" ||
  fail 'isolated PostgreSQL version check failed'
[[ "$server_version" =~ ^17[0-9]{4}$ ]] || fail 'isolated DB is not PostgreSQL 17'
# Supabase system roles and extensions are not exported as cluster globals.
# Never skip ACLs silently; missing prerequisites must be reported.
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE authenticator NOLOGIN;
CREATE ROLE supabase_admin NOLOGIN;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE supabase_storage_admin NOLOGIN;
CREATE ROLE dashboard_user NOLOGIN;
SQL
docker exec "$container" createdb -U postgres ff_m0_restore
docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d ff_m0_restore >/dev/null <<'SQL'
DROP SCHEMA public;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
SQL
docker cp "$temp/restore.dump" "$container:/tmp/ff_m0_restore.dump"
rm -f -- "$temp/restore.dump"
docker exec "$container" pg_restore -U postgres -d ff_m0_restore \
  --no-owner --exit-on-error --single-transaction /tmp/ff_m0_restore.dump ||
  fail 'offline restore failed; investigate platform-specific roles/extensions before retrying'
docker exec "$container" rm -f /tmp/ff_m0_restore.dump
# Real read-only live-schema attestations run on the restored archive.
# Synthetic CI expected row counts do not apply to real, possibly empty data.
for sql in \
  database/tests/0005_live_anon_posture.sql \
  database/tests/0006_live_immutable_ledger.sql \
  database/tests/0007_live_public_surface.sql; do
  [[ -f "$sql" ]] || fail "read-only verification SQL missing: $sql"
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres \
    -d ff_m0_restore < "$sql" >/dev/null ||
    fail "restored security/schema attestation failed: $sql"
done
printf 'PASS: owner-held age archive authenticated, local disconnected PostgreSQL 17 restored, 3 SQL posture checks passed.\n'
printf 'LIMIT: offsite retrieval, full Supabase services, independently stored hash and RPO/RTO require separate operator evidence.\n'
printf 'SECURITY: no ports published; container destroyed and plaintext copies cleaned at exit.\n'
