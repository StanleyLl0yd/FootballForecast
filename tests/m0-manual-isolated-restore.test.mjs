import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,readFileSync,chmodSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script=path.resolve('scripts/m0-manual-isolated-restore.sh');
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(name,{mutateManifest,symlinkArchive=false}={}){
  const root=mkdtempSync(path.join(tmpdir(),'ff-offline-recovery-'+name+'-'));
  const bin=path.join(root,'bin'),bundle=path.join(root,'bundle');
  mkdirSync(bin);mkdirSync(bundle);
  const archive='test-only-encrypted-fictional-bytes',file=path.join(bundle,'database.pg17.dump.age');
  writeFileSync(path.join(root,'contents'),archive);
  if(symlinkArchive)symlinkSync(path.join(root,'contents'),file);
  else writeFileSync(file,archive,{mode:0o600});
  const fields=[
    'format=postgres-custom-pg17-age-v1.3.2',
    'created_utc=2026-10-21T08:00:00Z',
    'scope=public,ff_private,auth',
    'archive=database.pg17.dump.age',
    'ciphertext_sha256='+sha(archive),
    'ciphertext_bytes='+Buffer.byteLength(archive),
    'excluded=global_roles,instance_config,external_secrets,storage_object_bytes'
  ];
  writeFileSync(path.join(bundle,'manifest.txt'),
    (mutateManifest?mutateManifest([...fields]):fields).join('\n')+'\n',{mode:0o600});
  const identity=path.join(root,'recovery.key');
  writeFileSync(identity,'AGE-SECRET-KEY-1ONLYTESTFAKE',{mode:0o600});
  const calls=path.join(root,'docker.log');
  function mock(name,body){writeFileSync(path.join(bin,name),'#!/bin/sh\n'+body+'\n',{mode:0o700})}
  mock('age',"if [ \"$1\" = '--version' ]; then echo 'age v1.3.2'; exit 0; fi\nexit 23");
  mock('docker',"printf '%s\\n' \"$*\" >> \"$FF_MOCK_DOCKER_LOG\"\nif [ \"$1\" = context ] && [ \"$2\" = show ]; then echo \"${FF_MOCK_DOCKER_CONTEXT_NAME:-default}\"; exit 0; fi\nif [ \"$1\" = context ] && [ \"$2\" = inspect ]; then if [ \"${FF_MOCK_DOCKER_REMOTE:-}\" = 1 ]; then echo ssh://remote.example; else echo unix:///var/run/docker.sock; fi; exit 0; fi\nif [ \"$1\" = image ]; then exit 0; fi\nexit 27");
  const env={...process.env,PATH:bin+':'+process.env.PATH,CI:'',GITHUB_ACTIONS:'',
    FF_RESTORE_BUNDLE_DIR:bundle,FF_AGE_IDENTITY_FILE:identity,
    FF_EXPECTED_CIPHERTEXT_SHA256:sha(archive),FF_MOCK_DOCKER_LOG:calls};
  const run=(override={})=>spawnSync('bash',[script],{env:{...env,...override},encoding:'utf8'});
  return {root,bin,bundle,identity,calls,run};
}
test('synthetic recovery refuses GitHub CI before touching archive',()=>{
  const f=fixture('ci'),r=f.run({GITHUB_ACTIONS:'true'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/CI forbidden/);
});
test('requires an independent recorded SHA, not only a same-bucket manifest',()=>{
  const f=fixture('sha');
  assert.match(f.run({FF_EXPECTED_CIPHERTEXT_SHA256:''}).stderr,/independently recorded SHA-256/);
  assert.match(f.run({FF_EXPECTED_CIPHERTEXT_SHA256:'0'.repeat(64)}).stderr,/manifest disagrees/);
});
test('rejects duplicate, unexpected and incomplete manifest fields',()=>{
  assert.match(fixture('duplicate',{mutateManifest:x=>[...x,x[0]]}).run().stderr,/duplicate manifest/);
  assert.match(fixture('extra',{mutateManifest:x=>[...x,'evil=danger']}).run().stderr,/unexpected manifest field/);
  assert.match(fixture('missing',{mutateManifest:x=>x.slice(0,-1)}).run().stderr,/manifest missing/);
});
test('rejects tampered size before decrypt or database container creation',()=>{
  const f=fixture('size',{mutateManifest:x=>x.map(s=>s.startsWith('ciphertext_bytes=')?'ciphertext_bytes=1':s)});
  assert.match(f.run().stderr,/size mismatch/);
  assert.equal(existsSync(f.calls),false,'docker must not be touched');
});
test('rejects same-length altered ciphertext even when manifest length still agrees',()=>{
  const f=fixture('hash-tamper');
  const archivePath=path.join(f.bundle,'database.pg17.dump.age');
  const original=readFileSync(archivePath,'utf8');
  writeFileSync(archivePath,'X'+original.slice(1));
  assert.match(f.run().stderr,/ciphertext hash mismatch/);
  assert.equal(existsSync(f.calls),false,'no Docker commands after a hash mismatch');
});
test('rejects archive symlinks, weak identity permissions and unexpected backup scopes',()=>{
  assert.match(fixture('symlink',{symlinkArchive:true}).run().stderr,/symlinked encrypted archive/);
  const f=fixture('scope',{mutateManifest:x=>x.map(s=>s.startsWith('scope=')?'scope=public':s)});
  assert.match(f.run().stderr,/unexpected archive format/);
  const weak=fixture('perm');chmodSync(weak.identity,0o644);
  assert.match(weak.run().stderr,/accessible to group\/others/);
});
test('remote Docker via DOCKER_HOST or DOCKER_CONTEXT is rejected before contacting Docker',()=>{
  for(const override of [{DOCKER_HOST:'ssh://remote.example'},{DOCKER_CONTEXT:'remote'},
    {DOCKER_TLS_VERIFY:'1'},{DOCKER_CERT_PATH:'/tmp/remote-docker-cert'}]){
    const f=fixture('docker-override');
    const r=f.run(override);
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/Docker connection override/);
    assert.equal(existsSync(f.calls),false,'Docker must not run if any remote override exists');
  }
});
test('remote or nondefault Docker context fails before image inspection or decryption',()=>{
  for(const override of [{FF_MOCK_DOCKER_REMOTE:'1'},
    {FF_MOCK_DOCKER_CONTEXT_NAME:'remote-production'}]){
    const f=fixture('remote-daemon');
    const r=f.run(override);
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/Docker (?:daemon endpoint|context)/);
    const calls=readFileSync(f.calls,'utf8');
    assert.match(calls,/context show/);
    assert.doesNotMatch(calls,/image inspect|run --rm|cp /);
  }
});
test('decryption failure never starts offline database container',()=>{
  const f=fixture('age-failure');
  const r=f.run();
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/archive decryption or integrity verification failed/);
  const log=readFileSync(f.calls,'utf8');
  assert.match(log,/image inspect postgres:17/);
  assert.doesNotMatch(log,/run --pull never/);
});
test('recovery is offline-only and fails closed on actual SQL restoration',()=>{
  const source=readFileSync(script,'utf8');
  for(const pattern of [/--pull never/,/--network none/,/POSTGRES_HOST_AUTH_METHOD=trust/,
    /\/dev\/shm/,/docker rm -fv/,/docker run --rm --pull never/,/--single-transaction/,/--exit-on-error/,
    /0005_live_anon_posture\.sql/,/0006_live_immutable_ledger\.sql/,
    /0007_live_public_surface\.sql/,/CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions/])assert.match(source,pattern);
  assert.match(source,/docker context inspect default --format/);
  assert.match(source,/docker_context.*default/);
  assert.match(source,/unix:\/\/\/var\/run\/docker\.sock/);
  assert.match(source,/local Docker daemon socket is absent/);
  assert.match(source,/private identity must remain outside Git checkout/);
  assert.match(source,/repo_root=.*BASH_SOURCE/);
  assert.match(source,/docker rm -fv/);
  assert.match(source,/cleanup of recovered PostgreSQL container\/volumes failed/);
  assert.match(source,/trap - EXIT/);
  assert.doesNotMatch(source,/pg_dump|curl|wget|supabase\.co|:5432\/postgres/);
});


test('synthetic success must prove Docker volume removal before printing PASS',()=>{
  const f=fixture('mock-full-rehearsal');
  writeFileSync(path.join(f.bin,'age'),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "age v1.3.2"; exit 0; fi\nwhile [ "$#" -gt 0 ]; do\nif [ "$1" = "--output" ]; then shift; printf "synthetic-decrypted-test-dump" > "$1"; exit 0; fi\nshift\ndone\nexit 22\n',{mode:0o700});
  writeFileSync(path.join(f.bin,'docker'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FF_MOCK_DOCKER_LOG"\nif [ "$1" = context ] && [ "$2" = show ]; then echo default; exit 0; fi\nif [ "$1" = context ] && [ "$2" = inspect ]; then echo unix:///var/run/docker.sock; exit 0; fi\ncase "$*" in *"SHOW server_version_num"*) echo 170011;; esac\nexit 0\n',{mode:0o700});
  const r=f.run();
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/PASS: owner-held age archive authenticated/);
  const log=readFileSync(f.calls,'utf8');
  assert.match(log,/run --rm --pull never -d --name ff-m0-restore-/);
  assert.match(log,/--network none/);
  assert.match(log,/pg_restore/);
  assert.match(log,/rm -fv ff-m0-restore-/);
});
test('synthetic Docker cleanup failure must not print PASS',()=>{
  const f=fixture('mock-cleanup-fail');
  writeFileSync(path.join(f.bin,'age'),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "age v1.3.2"; exit 0; fi\nwhile [ "$#" -gt 0 ]; do\nif [ "$1" = "--output" ]; then shift; printf "synthetic-decrypted-test-dump" > "$1"; exit 0; fi\nshift\ndone\nexit 22\n',{mode:0o700});
  writeFileSync(path.join(f.bin,'docker'),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FF_MOCK_DOCKER_LOG"\nif [ "$1" = context ] && [ "$2" = show ]; then echo default; exit 0; fi\nif [ "$1" = context ] && [ "$2" = inspect ]; then echo unix:///var/run/docker.sock; exit 0; fi\ncase "$*" in *"SHOW server_version_num"*) echo 170011;; esac\nif [ "$1" = "rm" ]; then exit 29; fi\nexit 0\n',{mode:0o700});
  const r=f.run();
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/cleanup of recovered PostgreSQL container\/volumes failed/);
  assert.match(r.stderr,/CRITICAL: verify manual removal/);
  assert.doesNotMatch(r.stdout,/PASS: owner-held age/);
});
