import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {parseBoundedCsv,summarizeFootbolnoRplCsv} from '../lib/source-preview-core.mjs';
import {readResponseTextBounded} from '../lib/limited-response.mjs';

const HEADER=['match_id','league_id','season','date_utc','status',
  'home_id','away_id','home_goals','away_goals','home','away','time_confirmed'];
const toCsv=rows=>[HEADER,...rows].map(r=>r.map(x=>{
  const s=String(x);
  return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}).join(',')).join('\r\n')+'\r\n';

const createRows=(season,{finished=240,score=[2,1]}={})=>{
  const out=[];
  for(let i=0;i<16;i++)for(let j=0;j<16;j++){
    if(i===j)continue;
    const n=out.length,complete=n<finished;
    const date=season==='2024/2025'?'2025-03-01T13:00:00Z':
      season==='2025/2026'?'2026-03-01T13:00:00Z':'2026-10-01T13:00:00Z';
    out.push([season+'-'+i+'-'+j,235,season,date,
      complete?'finished':'scheduled',i+1,j+1,
      complete?score[0]:'',complete?score[1]:'',
      'Club "A", test', 'Club B',1]);
  }
  return out;
};

test('Footbolno RPL scope: 240 directed pairs, 3 seasons, temporary counts only',()=>{
  const csv=toCsv([
    ...createRows('2024/2025',{score:[2,1]}),
    ...createRows('2025/2026',{score:[0,0]}),
    ...createRows('2026/2027',{finished:88,score:[1,2]})
  ]);
  const parsed=parseBoundedCsv(csv);
  assert.equal(parsed.rows.length,720);
  assert.equal(parsed.rows[0][9],'Club "A", test');
  const a=summarizeFootbolnoRplCsv(csv,'2026-09-01T00:00:00Z');
  assert.equal(a.publisherRows,720);
  assert.deepEqual(a.seasonSummaries.map(s=>[
    s.season,s.matches,s.finished,s.scheduled,s.homeGoals+s.awayGoals,s.structuralCandidate
  ]),[
    ['2024/2025',240,240,0,720,true],
    ['2025/2026',240,240,0,0,true],
    ['2026/2027',240,88,152,264,true]
  ]);
  for(const key of ['recordRevisionTimestampsAvailable','originalMatchRightsVerified',
    'sourceMatchAccuracyVerified','modelTrainingApproved'])assert.equal(a[key],false);
  assert.ok(a.upcomingFixtures.length<=8);
  assert.doesNotMatch(JSON.stringify(a),/match_id|home_id|away_id/);
});
test('upcoming 2026/27 fixtures are opt-in, capped, sorted, and never invent confirmed times',()=>{
  const rows=createRows('2026/2027',{finished:0});
  rows[1][11]='0'; // A date without a confirmed kickoff time
  rows[2][3]='2026-09-01T08:00:00Z'; // Past completed? still labeled scheduled: do not display
  const summary=summarizeFootbolnoRplCsv(toCsv(rows),'2026-10-01T10:00:00Z');
  assert.equal(summary.upcomingFixtures.length,8);
  assert.ok(summary.upcomingFixtures.every(f=>
    f.kickoffUtc>='2026-10-01T00:00:00Z'));
  assert.ok(summary.upcomingFixtures.some(f=>!f.timeConfirmed));
  for(const f of summary.upcomingFixtures){
    assert.ok(f.home.length<=80&&f.away.length<=80);
    assert.ok(!Object.hasOwn(f,'match_id'));
    assert.deepEqual(Object.keys(f).sort(),
      ['away','home','kickoffUtc','timeConfirmed']);
  }
  const after=summarizeFootbolnoRplCsv(toCsv(rows),'2026-10-02T00:00:00Z');
  assert.equal(after.upcomingFixtures.length,0);
  rows[0][3]='nonsense';
  const missing=summarizeFootbolnoRplCsv(toCsv(rows),'2026-09-30T00:00:00Z');
  assert.ok(!missing.upcomingFixtures.some(f=>f.kickoffUtc.includes('nonsense')));
});

test('reject incorrect calendar dates, off-season fixtures, incomplete UTC time and stale scheduled matches',()=>{
  const rows=createRows('2026/2027',{finished:0});
  rows[0][3]='2026-02-30T12:00:00Z'; // JS Date.parse can roll over bad days
  rows[1][3]='2027-09-01T10:00:00Z'; // Different season
  rows[2][11]='unknown'; // Time confirmed flag is strictly 0 or 1
  rows[3][3]='2026-10-01'; // Only a calendar day, cannot be confirmed exact kickoff
  const report=summarizeFootbolnoRplCsv(toCsv(rows),'2026-09-01T00:00:00Z');
  const cur=report.seasonSummaries[2];
  assert.equal(cur.invalidDates,2);
  assert.equal(cur.invalidTimeFlags,2);
  assert.equal(cur.pastScheduled,0);
  assert.equal(cur.structuralCandidate,false);
  assert.equal(report.upcomingFixtures.length,8);
  assert.ok(report.upcomingFixtures.every(f=>
    f.kickoffUtc<'2027-07-01T00:00:00Z'));
  const stale=summarizeFootbolnoRplCsv(toCsv(rows),'2026-11-01T00:00:00Z');
  assert.equal(stale.seasonSummaries[2].pastScheduled,238);
  assert.equal(stale.upcomingFixtures.length,0);
  assert.equal(stale.seasonSummaries[2].structuralCandidate,false);
});
test('frozen 2024/25 and 2025/26 Footbolno publisher aggregates expose silent score drift',()=>{
  const pinned=JSON.parse(readFileSync(new URL('../../../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json',import.meta.url),'utf8'));
  assert.equal(pinned.sourceSHA256,'dab9b30d69d2c2f7fe2fcadde2aff636552362c08ed7eaa9fe1191d19513c214');
  const rows=[];
  for(const [year,extraHome,extraAway] of [
    ['2024/2025',124,44],['2025/2026',108,21]
  ]){
    const seasonRows=createRows(year,{finished:240,score:[1,1]});
    for(let i=0;i<seasonRows.length;i++){
      if(i<extraHome)seasonRows[i][7]='2';
      if(i<extraAway)seasonRows[i][8]='2';
    }
    rows.push(...seasonRows);
    const ref=pinned.seasons.find(x=>x.season===year);
    assert.ok(ref);
    assert.equal(240+extraHome,ref.sourceReportedScoresNotAuthenticatedOnField.home);
    assert.equal(240+extraAway,ref.sourceReportedScoresNotAuthenticatedOnField.away);
  }
  const baseline=summarizeFootbolnoRplCsv(toCsv(rows),'2026-10-22T00:00:00Z');
  for(const s of baseline.seasonSummaries.slice(0,2)){
    assert.equal(s.structuralCandidate,true);
    assert.deepEqual(s.historicalAggregateDrift,{
      baselineSHA256:pinned.sourceSHA256,referenceDate:'2026-10-20',
      homeDelta:0,awayDelta:0,finishedDelta:0,changed:false
    });
  }
  assert.equal(baseline.seasonSummaries[2].historicalAggregateDrift,null);
  // An in-place publisher correction can preserve all 240 fixture identities.
  // Detect changing score totals without pretending it is definitively wrong.
  rows[0][7]='3';
  const later=summarizeFootbolnoRplCsv(toCsv(rows),'2026-10-22T00:00:00Z');
  assert.equal(later.seasonSummaries[0].matches,240);
  assert.equal(later.seasonSummaries[0].structuralCandidate,true);
  assert.equal(later.seasonSummaries[0].historicalAggregateDrift.homeDelta,1);
  assert.equal(later.seasonSummaries[0].historicalAggregateDrift.awayDelta,0);
  assert.equal(later.seasonSummaries[0].historicalAggregateDrift.changed,true);
  assert.equal(later.seasonSummaries[1].historicalAggregateDrift.changed,false);
  assert.deepEqual(later.upcomingFixtures,[]);
});

test('CSV strict syntax: quoted commas and newline are allowed, duplicate headers and broken quoting fail',()=>{
  const rows=createRows('2024/2025').slice(0,1);
  rows[0][9]='a,"b"\r\nc';
  assert.equal(parseBoundedCsv(toCsv(rows)).rows[0][9],'a,"b"\r\nc');
  assert.throws(()=>parseBoundedCsv('match_id,match_id\nx,y\n'),/Duplicate/);
  assert.throws(()=>parseBoundedCsv('match_id,"bad\nx,y'),/Unclosed/);
  assert.throws(()=>parseBoundedCsv('match_id,b\n"abc"DEF,y'),/Unexpected/);
  assert.throws(()=>parseBoundedCsv('a,b\n1,2\n'),/CSV fields missing/);
  assert.throws(()=>parseBoundedCsv('a,b\n1\n'),/CSV fields missing/);
});
test('duplicate fixtures and IDs are counted, never accepted as structure-complete',()=>{
  const rows=createRows('2024/2025');
  rows[1][5]=rows[0][5];rows[1][6]=rows[0][6];
  rows[2][0]=rows[0][0];
  const a=summarizeFootbolnoRplCsv(toCsv(rows)).seasonSummaries[0];
  assert.equal(a.matches,240);
  assert.equal(a.duplicates,1);
  assert.equal(a.duplicateMatchIds,1);
  assert.equal(a.structuralCandidate,false);
});
test('invalid scores, missing IDs, incorrect finished count cannot pass structural check',()=>{
  const rows=createRows('2025/2026');
  rows[0][7]='100';rows[1][5]='';rows[2][4]='live';
  const a=summarizeFootbolnoRplCsv(toCsv(rows)).seasonSummaries[1];
  assert.equal(a.invalidScores,1);
  assert.equal(a.missingTeams,1);
  assert.equal(a.finished,239);
  assert.equal(a.structuralCandidate,false);
  rows[3][4]='mystery';
  assert.throws(()=>summarizeFootbolnoRplCsv(toCsv(rows)),/Unknown league match status/);
});
test('wrong tournament IDs and irrelevant years are never counted as RPL pilot seasons',()=>{
 const rows=createRows('2024/2025').slice(0,4);
 rows[0][1]='444';rows[1][2]='2022/2023';
 const a=summarizeFootbolnoRplCsv(toCsv(rows));
 assert.equal(a.seasonSummaries[0].matches,2);
 assert.ok(a.seasonSummaries.every(s=>s.structuralCandidate===false));
});
test('enforce hard CSV row, character and column budgets before retaining a report',()=>{
 const csv=toCsv(createRows('2024/2025'));
 assert.throws(()=>parseBoundedCsv(csv+'x'.repeat(2_000_001)),/budget/);
 const huge='match_id,league_id,season,status,home_id,away_id,home_goals,away_goals,date_utc\n'+
  Array.from({length:5001},(_,i)=>[i,235,'2024/2025','finished',1,2,1,2,'2026-01-01'].join(',')).join('\n');
 assert.throws(()=>parseBoundedCsv(huge),/CSV row budget exceeded/);
});

const makeResponse=(chunks,{length=null,type='text/plain'}={})=>{
 const headers={'content-type':type};
 if(length!==null)headers['content-length']=String(length);
 return new Response(new ReadableStream({
  start(c){for(const chunk of chunks)c.enqueue(new Uint8Array(chunk));c.close()}
 }),{status:200,headers});
};
test('streaming reader handles split Unicode and enforces bytes without Content-Length',async()=>{
 const value=new TextEncoder().encode('Футбол');
 const r=makeResponse([value.slice(0,1),value.slice(1)]);
 assert.equal(await readResponseTextBounded(r,100),'Футбол');
 await assert.rejects(readResponseTextBounded(makeResponse([
   new Uint8Array(15),new Uint8Array(30)
 ]),20),/byte budget/);
 await assert.rejects(readResponseTextBounded(makeResponse([new Uint8Array(1)],{length:100}),20),
    /declared payload/);
 await assert.rejects(readResponseTextBounded(makeResponse([]),20),/Empty/);
 await assert.rejects(readResponseTextBounded(makeResponse([new Uint8Array([0xff])]),20),/encoded|valid|utf/i);
});
