import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const script = path.resolve('scripts/m0-manual-encrypted-export.sh');
const fixtures = mkdtempSync(path.join(tmpdir(), 'ff-manual-export-test-'));
const mocks = path.join(fixtures, 'bin');
mkdirSync(mocks);
function mock(name, content) {
  const file = path.join(mocks, name);
  writeFileSync(file, `#!/bin/sh\n${content}\n`, { mode: 0o700 });
}
mock('pg_dump', `if [ "\${1:-}" = '--version' ]; then echo 'pg_dump (PostgreSQL) 17.11'; exit 0; fi
if [ "\${FF_MOCK_DUMP_FAIL:-}" = 1 ]; then exit 23; fi
printf 'synthetic-not-production-database-content'`);
mock('psql', `printf '170011\\n'`);
mock('age', `if [ "\${1:-}" = '--version' ]; then echo 'age v1.3.2'; exit 0; fi
if [ "\${FF_MOCK_AGE_FAIL:-}" = 1 ]; then exit 23; fi
printf 'mock-ciphertext-only'; cat >/dev/null`);

function run(name, extra = {}) {
  const output = path.join(fixtures, name);
  const env = {
    PATH: `${mocks}:${process.env.PATH}`,
    HOME: fixtures,
    FF_AGE_RECIPIENT: 'age1' + 'q'.repeat(58),
    FF_BACKUP_OUTPUT_DIR: output,
    PGHOST: 'mock.invalid',
    PGPORT: '5432',
    PGDATABASE: 'postgres',
    PGUSER: 'postgres',
    PGPASSWORD: 'test-only-not-real',
    PGSSLMODE: 'verify-full',
    CI: '',
    GITHUB_ACTIONS: '',
    ...extra,
  };
  const result = spawnSync('bash', [script], { encoding: 'utf8', env });
  return { output, result };
}

test('exports only encrypted archive and manifest with expected hash and strict permissions', () => {
  const { output, result } = run('success');
  assert.equal(result.status, 0, result.stderr);
  const [dir] = readdirSync(output);
  assert.match(dir, /^ff-pg17-/);
  assert.equal(statSync(path.join(output, dir)).mode & 0o777, 0o700);
  const files = readdirSync(path.join(output, dir)).sort();
  assert.deepEqual(files, ['database.pg17.dump.age', 'manifest.txt']);
  assert.equal(statSync(path.join(output, dir, files[0])).mode & 0o777, 0o600);
  const archive = readFileSync(path.join(output, dir, files[0]));
  assert.equal(archive.toString(), 'mock-ciphertext-only');
  const hash = execFileSync('sha256sum', [path.join(output, dir, files[0])], { encoding: 'utf8' }).split(' ')[0];
  const manifest = readFileSync(path.join(output, dir, files[1]), 'utf8');
  assert.match(manifest, new RegExp(`ciphertext_sha256=${hash}`));
  assert.match(manifest, /excluded=global_roles,instance_config,external_secrets,storage_object_bytes/);
  assert.doesNotMatch(result.stdout, /synthetic-not-production-database-content|test-only-not-real/);
});

test('refuses to export from CI', () => {
  const { result } = run('ci-denied', { GITHUB_ACTIONS: 'true' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CI is forbidden/);
});

test('requires verified TLS hostname and port 5432', () => {
  assert.match(run('tls-denied', { PGSSLMODE: 'require' }).result.stderr, /verify-full/);
  assert.match(run('port-denied', { PGPORT: '6543' }).result.stderr, /5432/);
});

test('rejects pg_dump failure instead of archiving truncated bytes', () => {
  const { output, result } = run('dump-fail', { FF_MOCK_DUMP_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.deepEqual(readdirSync(output), []);
});

test('rejects encryption failure and discards partial output', () => {
  const { output, result } = run('age-fail', { FF_MOCK_AGE_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.deepEqual(readdirSync(output), []);
});

test('refuses output directories inside the Git checkout', () => {
  const { result } = run('inside-repo-denied', { FF_BACKUP_OUTPUT_DIR: path.dirname(script) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside the repository checkout/);
});
