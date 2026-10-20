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
encrypted_archive="${RUNNER_TEMP}/ff-m0-synthetic.dump.age"
age_tarball="${RUNNER_TEMP}/ff-age-v1.3.2-linux-amd64.tar.gz"
age_dir="$(mktemp -d "${RUNNER_TEMP}/ff-age-ci.XXXXXX")"
identity="$age_dir/recovery.key"
cleanup() {
  docker rm -f "$restore_container" >/dev/null 2>&1 || true
  rm -f -- "$archive" "$encrypted_archive" "$age_tarball"
  rm -rf -- "$age_dir"
}
trap cleanup EXIT

docker exec "$source_container" pg_dump -U postgres -d postgres -Fc \
  -n auth -n ff_private -n public -f /tmp/ff_m0_fixture.dump
docker cp "$source_container:/tmp/ff_m0_fixture.dump" "$archive"
source_hash="$(sha256sum "$archive" | cut -d ' ' -f1)"
test -n "$source_hash"

# Obtain one *exact immutable* official age binary and verify GitHub release
# asset SHA-256 before execution. No paid service or mutable npm dependency.
curl --fail --silent --show-error --location \
  --proto '=https' --proto-redir '=https' --max-redirs 4 \
  --connect-timeout 12 --max-time 90 --max-filesize 25000000 \
  --output "$age_tarball" \
  'https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz'
printf '%s  %s\n' \
  'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10' \
  "$age_tarball" | sha256sum --check --status
tar -xzf "$age_tarball" -C "$age_dir" age/age age/age-keygen
test -x "$age_dir/age/age"
test -x "$age_dir/age/age-keygen"

# Synthetic, disposable CI identity: a real recovery key MUST instead be
# retained OFFLINE by the owner, never in Actions or the backup bucket.
"$age_dir/age/age-keygen" -o "$identity" >/dev/null 2>&1
recipient="$("$age_dir/age/age-keygen" -y "$identity")"
[[ "$recipient" == age1* ]]
"$age_dir/age/age" -e -r "$recipient" -o "$encrypted_archive" "$archive"
test -s "$encrypted_archive"
encrypted_hash="$(sha256sum "$encrypted_archive" | cut -d ' ' -f1)"
test "$encrypted_hash" != "$source_hash"

# Deliberate ciphertext corruption MUST NOT authenticate/decrypt.
cp "$encrypted_archive" "$age_dir/tampered.age"
python3 - "$age_dir/tampered.age" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
data = bytearray(p.read_bytes())
assert len(data) > 128
data[-1] ^= 1
p.write_bytes(data)
PY
if "$age_dir/age/age" -d -i "$identity" \
  -o "$age_dir/tampered-output" "$age_dir/tampered.age" >/dev/null 2>&1; then
  echo 'ERROR: age accepted a corrupted backup ciphertext' >&2
  exit 1
fi
rm -f "$age_dir/tampered-output" "$age_dir/tampered.age"
# The runner no longer has an unencrypted *copy* to ship to the restore host.
rm -f -- "$archive"
docker exec "$source_container" rm -f /tmp/ff_m0_fixture.dump

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
# Transport ONLY encrypted bytes to a separate PostgreSQL 17 instance.
# The one-time test identity is supplied to simulate offline operator recovery.
docker cp "$encrypted_archive" "$restore_container:/tmp/ff_m0_fixture.dump.age"
docker cp "$age_dir/age/age" "$restore_container:/tmp/ff-ci-age"
docker cp "$identity" "$restore_container:/tmp/ff-ci-recovery.key"
remote_cipher_hash="$(docker exec "$restore_container" sha256sum /tmp/ff_m0_fixture.dump.age | cut -d ' ' -f1)"
test "$remote_cipher_hash" = "$encrypted_hash"
docker exec "$restore_container" /tmp/ff-ci-age -d \
  -i /tmp/ff-ci-recovery.key \
  -o /tmp/ff_m0_fixture.dump /tmp/ff_m0_fixture.dump.age
target_hash="$(docker exec "$restore_container" sha256sum /tmp/ff_m0_fixture.dump | cut -d ' ' -f1)"
test "$target_hash" = "$source_hash"
docker exec "$restore_container" rm -f \
  /tmp/ff_m0_fixture.dump.age /tmp/ff-ci-age /tmp/ff-ci-recovery.key

docker exec "$restore_container" createdb -U postgres ff_restore_ci
docker exec "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres -d ff_restore_ci \
  -c 'DROP SCHEMA public'
docker exec "$restore_container" pg_restore -U postgres --no-owner \
  --exit-on-error -d ff_restore_ci /tmp/ff_m0_fixture.dump
docker exec -i "$restore_container" psql -v ON_ERROR_STOP=1 -U postgres \
  -d ff_restore_ci < database/tests/0004_restore_validation.sql

echo 'PASS: verified pinned age tool, tamper rejection, ciphertext-only transfer, PostgreSQL 17 isolated restore and RLS/trigger/row integrity'
