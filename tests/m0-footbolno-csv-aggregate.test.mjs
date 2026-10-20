import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {inspectFreeRplCsv,publisherCsv} from '../scripts/m0-footbolno-csv-aggregate.mjs';

const head='match_id,league_id,season,status,home_id,away_id,home_goals,away_goals';
const row=(id,season,status,home,away,hg='',ag='')=>
  [id,'235',season,status,home,away,hg,ag].join(',');
const fixture=()=>[head,
  row('001','2026/2027','finished','h01','a01','2','1'),
  row('002','2026/2027','scheduled','h02','a02'),
  row('003','2026/2027','finished','h03','a03','1','0'),
  row('004','2025/2026','finished','h04','a04','3','0'),
  row('005','2026/2027','cancelled','h02','a03')
].join('\n');
const verify=raw=>{
  const b=Buffer.from(raw,'utf8');
  return inspectFreeRplCsv(b,createHash('sha256').update(b).digest('hex'));
};
test('bounded synthetic evidence groups by season, counts statuses but never approves rights',()=>{
  const report=verify(fixture());
  assert.equal(report.sourceUrl,publisherCsv);
  assert.equal(report.schemaVersion,1);
  assert.equal(report.csvRecordCount,5);
  assert.equal(report.seasonStats.length,2);
  assert.equal(report.licensedForTraining,false);
  assert.equal(report.licensedForRedistribution,false);
  assert.equal(report.active,false);
  assert.equal(report.historicalPrematchSnapshotsVerified,false);
  assert.equal(report.officialMatchAccuracyMeasured,false);
  assert.equal(report.rowsSavedInGitOrSupabase,false);
  const season=report.seasonStats.find(s=>s.season==='2026/2027');
  assert.equal(season.sourceRows,4);
  assert.deepEqual(season.statuses,{finished:2,scheduled:1,live:0,cancelled:1});
  assert.equal(season.distinctClubCount,6);
  assert.equal(season.distinctDirectedPairs,4);
  assert.deepEqual(season.sourceReportedScoreTotalsNotVerifiedOnField,{home:3,away:1});
  assert.equal(season.complete240GameRplSeasonNOTEstablished,true);
  assert.ok(!JSON.stringify(report).includes('h01'));
  assert.ok(!JSON.stringify(report).includes('a01'));
});
test('per-season duplicate match IDs and oriented fixture duplicates are not accepted as independent games',()=>{
  const raw=fixture()+'\n'+row('001','2026/2027','finished','h01','a01','2','1');
  const report=verify(raw);
  const s=report.seasonStats.find(s=>s.season==='2026/2027');
  assert.equal(s.duplicateMatchIds,1);
  assert.equal(s.duplicateDirectedPairs,1);
  assert.equal(s.sourceRows,5);
  assert.equal(s.distinctDirectedPairs,4);
});
test('invalid status, season and foreign league rows are counted but do not forge a usable league',()=>{
  const raw=fixture()+'\n'+row('bad','2026/2027','postponed','h05','a05')+
    '\n'+row('oops','bad-season','finished','h06','a06','1','0')+
    '\n'+row('nonrpl','2026/2027','finished','h07','a07','1','0').replace(',235,',',123,');
  const result=verify(raw);
  assert.equal(result.unknownStatusRows,1);
  assert.equal(result.unknownSeasonRows,1);
  assert.equal(result.invalidLeagueRows,1);
  assert.equal(result.seasonStats.find(s=>s.season==='2026/2027').sourceRows,5);
});
test('invalid scores cannot become observed on-field goals, even if status says finished',()=>{
  const raw=fixture()+'\n'+row('006','2026/2027','finished','h05','a05','31','-1');
  const report=verify(raw);
  assert.equal(report.seasonStats.find(s=>s.season==='2026/2027').invalidFinishedScores,1);
  assert.equal(report.seasonStats.find(s=>s.season==='2026/2027').sourceReportedScoreTotalsNotVerifiedOnField.home,3);
});
test('quote-aware CSV parser accepts doubled quotes, embedded commas, CRLF and UTF-8 BOM',()=>{
  const raw='\ufeff'+head+'\r\n'+
    '007,235,2026/2027,finished,"Team, \"\"Rival\"\"",away,1,1\r\n';
  const report=verify(raw);
  assert.equal(report.seasonStats[0].sourceRows,1);
  assert.equal(report.seasonStats[0].distinctClubCount,2);
  assert.equal(report.seasonStats[0].sourceReportedScoreTotalsNotVerifiedOnField.home,1);
});
test('reject incorrect hash, malformed CSV and oversized cells without raw contents in errors',()=>{
  const bytes=Buffer.from(fixture());
  assert.throws(()=>inspectFreeRplCsv(bytes,'0'.repeat(64)),/hash pin mismatch/);
  for(const raw of [
    head+'\n'+row('001','2026/2027','finished','h01','a01','1'),
    head+'\n'+row('001','2026/2027','finished','h01','a01','1','0')+',EXTRA',
    head+'\n'+row('001','2026/2027','finished','h01','a01','1','0')+'\n'+row('002','2026/2027','finished','h01','a01','1','0')+'\n"notclosed',
    head+'\n'+row('001','2026/2027','finished','h01','a01','1','0')+'\n'+row('002','2026/2027','finished','h01','a01','1','0')+'\n'+row('003','2026/2027','finished','h01','a01','1','0')+'\n'+'X'.repeat(5000)
  ]){
    assert.throws(()=>verify(raw),e=>e.message.startsWith('Unapproved CSV inspection refused: ')&&!e.message.includes('h01'));
  }
  assert.throws(()=>inspectFreeRplCsv(Buffer.alloc(2*1024*1024+1),'0'.repeat(64)),/safe bounds/);
});
test('no free-to-read publisher contents or match-level identifiers leave the research summary',()=>{
  const report=verify(fixture());
  const serialized=JSON.stringify(report);
  for(const disallowed of ['h01','a01','h02','a02','001','002']) {
    // Numeric substrings can occur in SHA; check only distinctive team IDs.
    if(/[ha]\d\d/.test(disallowed))assert.ok(!serialized.includes(disallowed));
  }
  assert.equal(report.hasPublishedAtColumn,false);
  assert.equal(report.hasUpdatedAtColumn,false);
});
