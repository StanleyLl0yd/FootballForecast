import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {validateStageDataset,buildStageSql,validateStageTarget,classifyPsqlFailure} from '../scripts/m1-stage-import.mjs';
import {fixture} from './fixtures/m1-synthetic-dataset.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function mutateSeason(data,season,edit){
  const lines=data.seasonFiles[season].trimEnd().split('\n');
  const row=JSON.parse(lines[0]);edit(row);
  lines[0]=JSON.stringify(row);
  data.seasonFiles[season]=lines.join('\n')+'\n';
  data.manifest.snapshotSHA256[season]=hash(Buffer.from(data.seasonFiles[season]));
}
test('720 role-separated immutable source records validate without PostgreSQL writes',()=>{
  const data=fixture(),validated=validateStageDataset(data.manifest,data.seasonFiles);
  assert.equal(validated.records.length,720);
  assert.deepEqual(validated.records.map(x=>x.role).filter((r,i)=>i%240===0),
    ['train_baseline','sealed_holdout','current']);
  assert.equal(validated.records.filter(x=>x.kickoff===null).length,240);
  const sql=buildStageSql(validated);
  assert.match(sql,/begin;\n/);
  assert.match(sql,/ff_private\.ff_ingest_matches/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/normalized_sha256/);
  assert.match(sql,/on conflict \(source_id,source_sha256\)/);
  assert.ok(!sql.includes('Club 1'));
  assert.ok(!sql.includes('match-24-1'));
});
test('free database budget applies only after exact source-hash reuse and equivalence review',()=>{
  const data=fixture(),sql=buildStageSql(validateStageDataset(data.manifest,data.seasonFiles));
  const lock=sql.indexOf('pg_advisory_xact_lock');
  const direct=sql.indexOf('select id into snap from ff_private.ff_ingest_snapshots');
  const compact=sql.indexOf('select snapshot_id into snap from ff_private.ff_source_byte_observations');
  const budget=sql.indexOf('pg_database_size(pg_catalog.current_database()) >= 268435456');
  const comparison=sql.indexOf('except all');
  const insert=sql.indexOf('insert into ff_private.ff_ingest_snapshots');
  const observation=sql.indexOf('insert into ff_private.ff_source_byte_observations');
  assert.ok(lock>=0&&direct>lock&&compact>direct&&budget>compact&&
    comparison>budget&&insert>comparison&&observation>insert);
  assert.ok(sql.includes("then raise exception 'M1 private free-budget guard: database at 256 MiB'"));
  assert.ok(sql.includes('ff_private.ff_source_byte_observations'));
  assert.ok(sql.includes('on conflict (source_id,source_sha256) do nothing'));
  assert.match(sql,/source hash provenance mismatch/);
});

test('refuse any changed normalized bytes even if an upstream hash is claimed',()=>{
  const data=fixture();
  data.seasonFiles['2024/2025']=data.seasonFiles['2024/2025'].replace('Club 1','Club X');
  assert.throws(()=>validateStageDataset(data.manifest,data.seasonFiles),/hash or quality/);
});
test('reject season-role leakage, data quality gaps, unknown publication history',()=>{
  for(const change of [
    d=>d.manifest.sourceUrl='https://untrusted.example/test',
    d=>d.manifest.strictHistoricalBacktestingAllowed=true,
    d=>d.manifest.quality['2025/2026'].role='train_baseline',
    d=>d.manifest.quality['2025/2026'].ready=false,
    d=>d.manifest.snapshotSHA256['2024/2025']='z'.repeat(64)
  ]){
    const data=fixture();change(data);
    assert.throws(()=>validateStageDataset(data.manifest,data.seasonFiles),/Private stage refused/);
  }
});
test('reject quarantine, fake kickoff and nonfinal scores even if hashes are recomputed',()=>{
  for(const change of [
    r=>r.quarantineReason='invalid_finished_score',
    r=>r.publishedAtUtc='2024-07-30T10:00:00Z',
    r=>{r.kickoffUtc=null;r.kickoffTimeConfirmed=true;},
    r=>r.homeGoals=99,
    r=>r.status='live',
    r=>{r.calendarDateUtc='2024-08-01';r.kickoffUtc='2026-11-01T12:00:00.000Z';},
    r=>r.awayTeamId=r.homeTeamId
  ]){
    const data=fixture();
    mutateSeason(data,'2024/2025',change);
    assert.throws(()=>validateStageDataset(data.manifest,data.seasonFiles),/Private stage refused/);
  }
});
test('repeated match identities within one season are refused',()=>{
  const data=fixture();
  const season='2025/2026';
  const lines=data.seasonFiles[season].trimEnd().split('\n');
  const a=JSON.parse(lines[0]),b=JSON.parse(lines[1]);
  b.sourceMatchId=a.sourceMatchId;
  lines[1]=JSON.stringify(b);
  data.seasonFiles[season]=lines.join('\n')+'\n';
  data.manifest.snapshotSHA256[season]=hash(Buffer.from(data.seasonFiles[season]));
  assert.throws(()=>validateStageDataset(data.manifest,data.seasonFiles),/duplicate source fixture/);
});

test('dated planned fixture older than retrieval time is refused',()=>{
  const data=fixture();
  mutateSeason(data,'2026/2027',r=>{
    r.calendarDateUtc='2026-08-01';
    r.kickoffUtc=null;
    r.kickoffTimeConfirmed=false;
  });
  assert.throws(()=>validateStageDataset(data.manifest,data.seasonFiles),
    /stale scheduled fixture/);
});

test('private writer permits only the exact Frankfurt Supabase session tenant with full TLS verification',()=>{
  const valid={
    PGHOST:'aws-0-eu-central-1.pooler.supabase.com',
    PGUSER:'postgres.upulkesaiwnwfagjgteh',
    PGDATABASE:'postgres',PGPORT:'5432',PGSSLMODE:'verify-full'
  };
  assert.equal(validateStageTarget(valid),'supabase-verified-tenant');
  for(const bad of [
    {PGHOST:'db.upulkesaiwnwfagjgteh.supabase.co'},
    {PGHOST:'other.pooler.supabase.com'},
    {PGHOST:'aws-0-eu-central-1.pooler.supabase.com.evil.invalid'},
    {PGUSER:'postgres.anotherproject'},
    {PGDATABASE:'template1'},
    {PGPORT:'6543'},
    {PGSSLMODE:'require'},
    {PGSSLMODE:'disable'},
    {PGHOSTADDR:'127.0.0.1'},
    {PGSERVICE:'untrusted-service'}
  ])assert.throws(()=>validateStageTarget({...valid,...bad}),/Private stage refused/);
  assert.equal(validateStageTarget({
    PGHOST:'127.0.0.1',PGUSER:'postgres',PGDATABASE:'postgres',
    PGPORT:'5432',PGSSLMODE:'disable',FF_M1_LOCAL_TEST_ONLY:'1'
  }),'disposable-local-test');
  assert.throws(()=>validateStageTarget({
    PGHOST:'127.0.0.1',PGUSER:'postgres',PGDATABASE:'postgres',
    PGPORT:'5432',PGSSLMODE:'disable'
  }),/Private stage refused/);
});

test('PostgreSQL failure messages are classified without returning SQL, provider records or secrets',()=>{
  const secret='unique_sensitive_example_password';
  const sql='insert into ff_private.ff_ingest_matches values (\'private-raw-record\')';
  const cases=[
    [{error:{code:'ETIMEDOUT'}},'DB_CLIENT_TIMEOUT'],
    [{error:{code:'ENOENT'}},'DB_CLIENT_MISSING'],
    [{error:{code:'ENOBUFS'},stderr:'private-raw-record'},'DB_OUTPUT_LIMIT'],
    [{error:{code:'EACCES'}},'DB_CLIENT_DENIED'],
    [{error:{code:'ENOMEM'}},'DB_CLIENT_RESOURCE'],
    [{error:{code:'E2BIG'}},'DB_CLIENT_SIZE'],
    [{error:{code:'EOTHER'},stderr:secret},'DB_CLIENT_START'],
    [{status:2,stderr:'FATAL: password authentication failed '+secret},'DB_AUTH'],
    [{status:2,stderr:'root certificate was not verified '+secret},'DB_TLS'],
    [{status:2,stderr:'could not translate host name '+secret},'DB_DNS'],
    [{status:2,stderr:'connection refused '+secret},'DB_NETWORK'],
    [{status:2,stderr:secret},'DB_CONNECTION'],
    [{status:3,stderr:'ERROR: permission denied '+sql},'DB_PERMISSION'],
    [{status:3,stderr:'ERROR: relation foo does not exist '+sql},'DB_SCHEMA'],
    [{status:3,stderr:'ERROR: check constraint violation '+sql},'DB_SQL'],
    [{status:1,stderr:secret},'DB_CLIENT_EXIT']
  ];
  for(const [failed,expected] of cases){
    const actual=classifyPsqlFailure(failed);
    assert.equal(actual,expected);
    assert.match(actual,/^DB_[A-Z_]+$/);
    assert.ok(!actual.includes(secret)&&!actual.includes(sql));
  }
});

test('protected importer preflights connection and bounds PostgreSQL diagnostic output',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../scripts/m1-stage-import.mjs',import.meta.url),'utf8');
  const probe=source.indexOf("const probe=spawnSync('psql'");
  const write=source.indexOf("const result=spawnSync('psql'");
  assert.ok(probe>0&&write>probe);
  assert.match(source,/maxBuffer:32768/);
  assert.match(source,/maxBuffer:8\*1024\*1024/);
  assert.match(source,/VERBOSITY=terse/);
  assert.match(source,/SHOW_CONTEXT=never/);
  assert.match(source,/if\(probe.error\|\|probe.status!==0\)/);
  assert.ok(!source.includes('console.error(result.stderr)'));
});
