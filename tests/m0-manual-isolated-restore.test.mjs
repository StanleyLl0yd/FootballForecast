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
  mock('docker',"printf '%s\\n' \"$*\" >> \"$FF_MOCK_DOCKER_LOG\"\nif [ \"$1\" = image ]; then exit 0; fi\nexit 27");
  const env={...process.env,PATH:bin+':'+process.env.PATH,CI:'',GITHUB_ACTIONS:'',
    FF_RESTORE_BUNDLE_DIR:bundle,FF_AGE_IDENTITY_FILE:identity,
    FF_EXPECTED_CIPHERTEXT_SHA256:sha(archive),FF_MOCK_DOCKER_LOG:calls};
  const run=(override={})=>spawnSync('bash',[script],{env:{...env,...override},encoding:'utf8'});
  return {root,bundle,identity,calls,run};
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
test('rejects archive symlinks, weak identity permissions and unexpected backup scopes',()=>{
  assert.match(fixture('symlink',{symlinkArchive:true}).run().stderr,/symlinked encrypted archive/);
  const f=fixture('scope',{mutateManifest:x=>x.map(s=>s.startsWith('scope=')?'scope=public':s)});
  assert.match(f.run().stderr,/unexpected archive format/);
  const weak=fixture('perm');chmodSync(weak.identity,0o644);
  assert.match(weak.run().stderr,/accessible to group\/others/);
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
    /\/dev\/shm/,/docker rm -f/,/--single-transaction/,/--exit-on-error/,
    /0005_live_anon_posture\.sql/,/0006_live_immutable_ledger\.sql/,
    /0007_live_public_surface\.sql/])assert.match(source,pattern);
  assert.doesNotMatch(source,/pg_dump|curl|wget|supabase\.co|:5432\/postgres/);
});
