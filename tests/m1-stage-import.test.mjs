import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {validateStageDataset,buildStageSql,validateStageTarget} from '../scripts/m1-stage-import.mjs';
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
