#!/usr/bin/env bash
# Manual encrypted export candidate for an owner-controlled PostgreSQL 17 database.
# No upload, restore, credentials, plaintext archive or recovery key is handled here.
set -euo pipefail
umask 077

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }

# Real backups must be owner-initiated, never triggered by PRs or CI runners.
[[ -z "${CI:-}" && -z "${GITHUB_ACTIONS:-}" ]] || fail 'manual operator execution only; CI is forbidden'
[[ -n "${FF_AGE_RECIPIENT:-}" ]] || fail 'FF_AGE_RECIPIENT (public age recipient) is required'
[[ -n "${FF_BACKUP_OUTPUT_DIR:-}" ]] || fail 'FF_BACKUP_OUTPUT_DIR is required'
[[ -n "${PGHOST:-}" && -n "${PGUSER:-}" && -n "${PGDATABASE:-}" ]] || fail 'PGHOST, PGUSER and PGDATABASE are required'
[[ "${PGSSLMODE:-}" == 'verify-full' ]] || fail 'PGSSLMODE=verify-full is required'
[[ "${PGPORT:-5432}" == '5432' ]] || fail 'use the direct or session-pooler PostgreSQL 5432 port, never transaction pooling'
[[ -n "${PGPASSWORD:-}" || -n "${PGPASSFILE:-}" ]] || fail 'configure PGPASSFILE or PGPASSWORD outside the repository'

for executable in pg_dump psql age sha256sum mktemp; do
  command -v "$executable" >/dev/null 2>&1 || fail "missing required executable: $executable"
done
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-12}"

# Restrict version *before* connecting or streaming any production data.
[[ "$(LC_ALL=C pg_dump --version)" =~ PostgreSQL\)\ 17([.][0-9]+)?([[:space:]]|$) ]] || fail 'PostgreSQL 17 pg_dump is required'
[[ "$(age --version)" == 'age v1.3.2' ]] || fail 'age v1.3.2 is required; verify official binary SHA-256 before installation'
server_version="$(psql -X -A -t -w -v ON_ERROR_STOP=1 -c 'SHOW server_version_num')" || fail 'could not verify source database version'
[[ "$server_version" =~ ^17[0-9]{4}$ ]] || fail 'source database must be PostgreSQL 17'

[[ ! -L "$FF_BACKUP_OUTPUT_DIR" ]] || fail 'output directory must not be a symlink'
install -d -m 0700 -- "$FF_BACKUP_OUTPUT_DIR"
[[ -d "$FF_BACKUP_OUTPUT_DIR" ]] || fail 'backup output must be a directory'
output_dir="$(cd -- "$FF_BACKUP_OUTPUT_DIR" && pwd -P)"
repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
[[ "$output_dir" != "$repository_root" && "$output_dir" != "$repository_root/"* ]] || fail 'backup output must be outside the repository checkout'
working_dir="$(mktemp -d "$output_dir/.ff-export.XXXXXXXX")"
cleanup() { rm -rf -- "$working_dir"; }
trap cleanup EXIT

ciphertext="$working_dir/database.pg17.dump.age"
# pg_dump streams directly into age. No plaintext dump is ever written to disk.
# pg_dump must fail the entire pipe on error, even if age exits successfully.
pg_dump -w --format=custom --schema=public --schema=ff_private --schema=auth \
  | age --encrypt --recipient "$FF_AGE_RECIPIENT" > "$ciphertext" \
  || fail 'database export or encryption failed; partial ciphertext discarded'
[[ -s "$ciphertext" ]] || fail 'encrypted archive is empty'

hash="$(sha256sum "$ciphertext" | cut -d ' ' -f 1)"
size="$(wc -c < "$ciphertext" | tr -d ' ')"
timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$working_dir/manifest.txt" <<MANIFEST
format=postgres-custom-pg17-age-v1.3.2
created_utc=$timestamp
scope=public,ff_private,auth
archive=database.pg17.dump.age
ciphertext_sha256=$hash
ciphertext_bytes=$size
excluded=global_roles,instance_config,external_secrets,storage_object_bytes
MANIFEST

# The final export is exposed as a directory only after archive+manifest exist.
final_dir="$output_dir/ff-pg17-${timestamp//[:]/}-${working_dir##*.}"
[[ ! -e "$final_dir" ]] || fail 'refusing to overwrite a backup'
mv -T -- "$working_dir" "$final_dir"
working_dir=''  # Ownership moved to final path; do not remove it in EXIT trap.
printf 'Encrypted local export created: %s\n' "$final_dir"
printf 'Ciphertext SHA-256: %s\n' "$hash"
printf 'No offsite upload or recovery test has been performed.\n'