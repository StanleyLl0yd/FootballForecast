import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Buffer} from 'node:buffer';
import {mkdtempSync,readFileSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  normalizeFootbolnoCsv,writePrivateSnapshot,SOURCE_URL,ATTRIBUTION_URL
} from '../scripts/m1-footbolno-normalize.mjs';

const HEADER=['match_id','league_id','season','status','home_id','away_id',
  'home','away','home_goals','away_goals','date_utc','time_confirmed'].join(',');
const RETRIEVED='2026-10-29T15:00:00Z';
function row(season,index,status,date,confirmed='1',homeGoals='',awayGoals=''){
  const home='club'+String(index).padStart(2,'0');
  const away='club'+String((index+1)%16).padStart(2,'0');
  return [season.slice(2,4)+'-'+index,'235',season,status,home,away,
    'Club '+index,'Club '+((index+1)%16),homeGoals,awayGoals,date,confirmed].join(',');
}
function baseline(){
  const rows=[HEADER];
  for(const season of ['2024/2025','2025/2026','2026/2027']){
    for(let i=0;i<16;i++){
      const current=season==='2026/2027',future=current&&i>=8;
      rows.push(row(season,i,future?'scheduled':'finished',
        future?'2026-11-01T12:00:00Z':
          current?'2026-08-01T12:00:00Z':
            season==='2024/2025'?'2024-08-01T12:00:00Z':'2025-08-01T12:00:00Z',
        '1',future?'':'2',future?'':'1'));
    }
  }
  return rows;
}
function parse(rows=baseline(),date=RETRIEVED){
  return normalizeFootbolnoCsv(Buffer.from(rows.join('\n')+'\n'),date,
    {expectedFixtures:16});
}
test('M1 three-season snapshots are deterministic, separated and attributed',()=>{
  const first=parse(),second=parse();
  assert.deepEqual(first,second);
  assert.equal(first.manifest.sourceUrl,SOURCE_URL);
  assert.equal(first.manifest.licenseUrl,ATTRIBUTION_URL);
  assert.equal(first.manifest.historicalPrematchPublicationVerified,false);
  assert.equal(first.manifest.strictHistoricalBacktestingAllowed,false);
  const q=first.manifest.quality;
  assert.equal(q['2024/2025'].role,'train_baseline');
  assert.equal(q['2025/2026'].role,'sealed_holdout');
  assert.equal(q['2026/2027'].role,'current');
  for(const item of Object.values(q)){
    assert.equal(item.rows,16);
    assert.equal(item.teams,16);
    assert.equal(item.directedPairs,16);
    assert.equal(item.structural,true);
    assert.equal(item.ready,true);
  }
  assert.equal(q['2026/2027'].finished,8);
  assert.equal(q['2026/2027'].scheduled,8);
  for(const [season,body] of Object.entries(first.seasonFiles)){
    const records=body.trimEnd().split('\n').map(JSON.parse);
    assert.equal(records.length,16);
    assert.ok(records.every(x=>x.season===season&&
      x.publishedAtUtc===null&&x.quarantineReason===null));
    assert.ok(records.every(x=>x.sourceFileSha256===first.manifest.sourceFileSha256));
  }
});
test('quarantine stale scheduled fixtures; never relabel as finished',()=>{
  const rows=baseline();
  const index=rows.findIndex(r=>r.startsWith('26-8,235,2026/2027,scheduled'));
  rows[index]=rows[index].replace('2026-11-01T12:00:00Z','2026-10-01T12:00:00Z');
  const snapshot=parse(rows);
  assert.equal(snapshot.manifest.quality['2026/2027'].staleScheduled,1);
  assert.equal(snapshot.manifest.quality['2026/2027'].ready,false);
  const line=snapshot.seasonFiles['2026/2027'].split('\n').find(x=>x.includes('"sourceMatchId":"26-8"'));
  assert.equal(JSON.parse(line).quarantineReason,'stale_scheduled');
});
test('a finished match after retrieval is quarantined, never trained',()=>{
  const rows=baseline();
  const i=rows.findIndex(r=>r.startsWith('26-0,235,2026/2027,finished'));
  rows[i]=rows[i].replace('2026-08-01T12:00:00Z','2026-11-01T12:00:00Z');
  const q=parse(rows).manifest.quality['2026/2027'];
  assert.equal(q.futureFinished,1);
  assert.equal(q.ready,false);
});
test('missing or absurd score quarantines completed training matches',()=>{
  const rows=baseline();
  const i=rows.findIndex(r=>r.startsWith('24-0,235'));
  rows[i]=rows[i].replace(',2,1,',',99,1,');
  const q=parse(rows).manifest.quality['2024/2025'];
  assert.equal(q.invalidScores,1);
  assert.equal(q.ready,false);
});
test('duplicate ID, pair and unknown status hard-fail without disclosing provider data',()=>{
  for(const mutation of [
    r=>{r[2]=r[1];},
    r=>{r[2]=r[2].replace('club01,club02','club00,club01');},
    r=>{r[2]=r[2].replace(',finished,',',mystery,');}
  ]){
    const rows=baseline();mutation(rows);
    assert.throws(()=>parse(rows),e=>e.message.startsWith('M1 Footbolno dataset refused: '));
  }
});
test('calendar-only unconfirmed kickoff never becomes midnight kickoff',()=>{
  const rows=baseline();
  const i=rows.findIndex(r=>r.startsWith('26-8,235'));
  rows[i]=rows[i].replace(',2026-11-01T12:00:00Z,1',',2026-11-01,0');
  const snapshot=parse(rows);
  const fixture=snapshot.seasonFiles['2026/2027'].split('\n').filter(Boolean)
    .map(JSON.parse).find(x=>x.sourceMatchId==='26-8');
  assert.equal(fixture.kickoffUtc,null);
  assert.equal(fixture.calendarDateUtc,'2026-11-01');
  assert.equal(fixture.kickoffTimeConfirmed,false);
  assert.equal(snapshot.manifest.quality['2026/2027'].ready,true);
});
test('no outputs outside private 0700 folder; files require new 0600 paths',()=>{
  const folder=mkdtempSync(join(tmpdir(),'ff-m1-test-'));
  try{
    writePrivateSnapshot(parse(),folder);
    assert.equal(lstatSync(join(folder,'rpl-2025-2026.jsonl')).mode&0o777,0o600);
    assert.equal(lstatSync(join(folder,'manifest.json')).mode&0o777,0o600);
    assert.equal(JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8')).dbImported,false);
    assert.throws(()=>writePrivateSnapshot(parse(),folder),/EEXIST/);
    assert.throws(()=>writePrivateSnapshot(parse(),'relative'),/absolute private/);
    assert.throws(()=>writePrivateSnapshot(parse(),'/tmp'),/mode 0700/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});
test('input bounds, invalid UTC retrieval timestamp and missing schema fail closed',()=>{
  assert.throws(()=>normalizeFootbolnoCsv(Buffer.alloc(2_000_001),RETRIEVED),/byte budget/);
  assert.throws(()=>parse(baseline(),'2026-10-29T15:00:00+03:00'),/UTC ISO/);
  const rows=baseline();rows[0]=HEADER.replace('date_utc','date_guess');
  assert.throws(()=>parse(rows),/mandatory publisher columns/);
});
