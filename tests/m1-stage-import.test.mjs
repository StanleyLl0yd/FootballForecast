import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {validateStageDataset,buildStageSql} from '../scripts/m1-stage-import.mjs';
import {SOURCE_URL,ATTRIBUTION_URL,SEASON_ROLES} from '../scripts/m1-footbolno-normalize.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const SOURCE_SHA=hash('synthetic-source-bytes');
const RETRIEVED='2026-10-29T15:00:00Z';
function fixture(){
  const seasonFiles={},quality={},snapshotSHA256={};
  for(const [season,role] of Object.entries(SEASON_ROLES)){
    const rows=[];
    for(let h=0;h<16;h++)for(let a=0;a<16;a++){
      if(h===a)continue;
      const historical=role!=='current';
      rows.push({
        source:'footbolno',sourceMatchId:'match-'+season.slice(2,4)+'-'+h+'-'+a,
        competition:'RPL',season,role,
        homeTeamId:'club-'+h,awayTeamId:'club-'+a,
        homeTeam:'Club '+h,awayTeam:'Club '+a,
        calendarDateUtc:historical?season.slice(0,4)+'-08-01':'2026-11-01',
        kickoffUtc:historical?season.slice(0,4)+'-08-01T12:00:00.000Z':null,
        kickoffTimeConfirmed:historical,
        status:historical?'finished':'scheduled',
        homeGoals:historical?2:null,awayGoals:historical?1:null,
        quarantineReason:null,publishedAtUtc:null,sourceFileSha256:SOURCE_SHA
      });
    }
    seasonFiles[season]=rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
    snapshotSHA256[season]=hash(Buffer.from(seasonFiles[season]));
    quality[season]={role,ready:true,rows:240,teams:16,directedPairs:240,
      quarantined:0,finished:role==='current'?0:240};
  }
  return {
    manifest:{schemaVersion:1,kind:'M1_PRIVATE_RPL_DATASET',
      source:'Footbolno',sourceUrl:SOURCE_URL,license:'CC BY 4.0',
      licenseUrl:ATTRIBUTION_URL,sourceFileSha256:SOURCE_SHA,
      retrievedAtUtc:RETRIEVED,snapshotSHA256,quality,
      historicalPrematchPublicationVerified:false,
      strictHistoricalBacktestingAllowed:false,modelTrained:false,dbImported:false},
    seasonFiles
  };
}
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
  assert.match(sql,/on conflict \(source_id,source_sha256,retrieved_at\)/);
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
