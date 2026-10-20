import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const snapshot=JSON.parse(readFileSync(
  new URL('../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json',import.meta.url),'utf8'));
const openfootball=JSON.parse(readFileSync(
  new URL('../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json',import.meta.url),'utf8'));

test('source-derived evidence is immutable by SHA and never authorizes provider training',()=>{
  assert.equal(snapshot.schemaVersion,1);
  assert.equal(snapshot.sourceId,235);
  assert.match(snapshot.sourceSHA256,/^[a-f0-9]{64}$/);
  assert.match(snapshot.reviewedAtUTC,/^2026-10-20T\d\d:\d\d:\d\dZ$/);
  for(const flag of ['providerRightsApproved','upstreamRightsVerified',
    'officialMatchByMatchTruthVerified','historicalPrematchAsOfVerified',
    'independentSourceAgreementVerified','authorizedForAutomatedTraining',
    'authorizedForRedistribution','activeInProduction','rowLevelRecordsPersisted'])
    assert.equal(snapshot[flag],false,flag);
  assert.equal(snapshot.hasRecognizedPerRecordPublishedAtColumn,false);
  assert.equal(snapshot.hasRecognizedPerRecordUpdatedAtColumn,false);
  assert.match(snapshot.administrativeAwardCaveat,/cannot by itself rule out awarded/);
});
test('all 2,571 retrospective provider rows and status tallies balance without raw match records',()=>{
  assert.equal(snapshot.seasons.length,11);
  assert.equal(snapshot.sourceRowCount,2571);
  assert.equal(snapshot.sourceColumnCount,22);
  assert.equal(snapshot.sourceBytes,542363);
  assert.equal(snapshot.seasons.reduce((n,s)=>n+s.sourceRows,0),snapshot.sourceRowCount);
  for(const s of snapshot.seasons){
    assert.match(s.season,/^20\d\d\/20\d\d$/);
    const vals=Object.values(s.statuses);
    assert.equal(vals.reduce((a,b)=>a+b,0),s.sourceRows);
    assert.ok(s.distinctDirectedPairs<=s.sourceRows);
    assert.ok(Number.isSafeInteger(s.distinctClubCount)&&s.distinctClubCount>=2);
    assert.equal(s.duplicateMatchIds,0);
    assert.equal(s.invalidFinishedScores,0);
    assert.ok(!('matchRows' in s)&&!('fixtures' in s)&&!('clubIds' in s));
    assert.ok(!('updatedAt' in s)&&!('publishedAt' in s));
    const structuralOK=s.sourceRows===240&&s.distinctClubCount===16&&
      s.distinctDirectedPairs===240&&s.duplicateDirectedPairs===0;
    assert.equal(s.structuralResearchClassification,structuralOK?
      'STRUCTURE_ONLY_CANDIDATE':'QUARANTINE_ANOMALOUS_SEASON');
  }
});
test('flag 2016-2021 damaged seasons; six newer seasons are structural only',()=>{
  const by=Object.fromEntries(snapshot.seasons.map(s=>[s.season,s]));
  assert.equal(snapshot.seasons.filter(s=>s.structuralResearchClassification==='QUARANTINE_ANOMALOUS_SEASON').length,5);
  assert.equal(snapshot.seasons.filter(s=>s.structuralResearchClassification==='STRUCTURE_ONLY_CANDIDATE').length,6);
  assert.equal(by['2016/2017'].sourceRows,163);
  assert.equal(by['2017/2018'].distinctClubCount,18);
  assert.equal(by['2018/2019'].sourceRows,244);
  assert.equal(by['2019/2020'].sourceRows,193);
  assert.equal(by['2020/2021'].duplicateDirectedPairs,36);
  assert.equal(by['2026/2027'].sourceRows,240);
  assert.deepEqual(by['2026/2027'].statuses,{finished:88,scheduled:152,live:0,cancelled:0});
  assert.equal(by['2026/2027'].distinctDirectedPairs,240);
  assert.equal(by['2026/2027'].distinctClubCount,16);
});
test('aggregation agrees for 2024/25 but 2018/19 differs; agreement is not accuracy or legal proof',()=>{
  const fb=Object.fromEntries(snapshot.seasons.map(s=>[s.season,s]));
  const of=Object.fromEntries(openfootball.seasons.map(s=>[s.season,s]));
  const f24=fb['2024/2025'].sourceReportedScoresNotAuthenticatedOnField,
    o24=of['2024/25'].sourceReportedPlayedGoals;
  assert.equal(f24.home,o24.home);
  assert.equal(f24.away,o24.away);
  assert.equal(f24.home,364);assert.equal(f24.away,284);
  const f18=fb['2018/2019'].sourceReportedScoresNotAuthenticatedOnField,
    o18=of['2018/19'].sourceReportedPlayedGoals;
  assert.notDeepEqual(f18,o18);
  assert.equal(f18.home-o18.home,4);
  assert.equal(f18.away-o18.away,4);
  const f23=fb['2023/2024'].sourceReportedScoresNotAuthenticatedOnField,
    o23=of['2023/24'].sourceReportedPlayedGoals;
  assert.equal(f23.home-o23.home,1);
  assert.equal(f23.away-o23.away,-1);
  assert.equal(snapshot.officialMatchByMatchTruthVerified,false);
  assert.equal(snapshot.independentSourceAgreementVerified,false);
});
