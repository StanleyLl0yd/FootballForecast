import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const evidence=JSON.parse(readFileSync(
  new URL('../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json',import.meta.url),'utf8'));

test('all source-version evidence remains research-only and version pinned',()=>{
  assert.equal(evidence.schemaVersion,1);
  assert.match(evidence.source,/^https:\/\/github\.com\/openfootball\/europe$/);
  assert.match(evidence.sourceCommit,/^[a-f0-9]{40}$/);
  for(const key of ['sourceApproved','empiricalMatchAccuracyMeasured',
    'independentOfficialFixtureVerification','archivalPrematchSnapshotsVerified','modelTrainingAllowed'])
    assert.equal(evidence[key],false,key);
  assert.equal(evidence.seasons.length,5);
});
test('240 match rows never imply 240 played events or 240 unique fixture pairs',()=>{
  const byYear=Object.fromEntries(evidence.seasons.map(s=>[s.season,s]));
  assert.deepEqual(Object.keys(byYear),['2018/19','2019/20','2020/21','2023/24','2024/25']);
  for(const season of evidence.seasons){
    assert.match(season.gitBlobSHA1,/^[a-f0-9]{40}$/);
    assert.match(season.path,/^russia\/\d{4}-\d{2}_ru1\.txt$/);
    assert.equal(season.claimedTeams,16);
    assert.equal(season.parsedMatches,season.claimedMatches);
    assert.equal(season.playedMatches+season.awardedMatches,season.parsedMatches);
    assert.equal(season.directedFixturePairs+season.duplicatePairs,season.parsedMatches);
    assert.equal(season.directedFixturePairs+season.missingPairs,240);
    const {home,draw,away}=season.sourceReportedAllResultWins;
    assert.equal(home+draw+away,season.parsedMatches);
    for(const val of Object.values({...season.sourceReportedPlayedGoals,
      ...season.sourceReportedAdministrativeGoals}))
      assert.ok(Number.isSafeInteger(val)&&val>=0);
  }
  assert.equal(byYear['2019/20'].playedMatches,236);
  assert.equal(byYear['2019/20'].awardedMatches,4);
  assert.deepEqual(byYear['2019/20'].sourceReportedAdministrativeGoals,{home:6,away:6});
  assert.equal(byYear['2020/21'].playedMatches,238);
  assert.equal(byYear['2020/21'].awardedMatches,2);
  assert.deepEqual(byYear['2020/21'].sourceReportedAdministrativeGoals,{home:3,away:3});
  assert.equal(byYear['2023/24'].directedFixturePairs,239);
  assert.equal(byYear['2023/24'].missingPairs,1);
  assert.match(byYear['2023/24'].knownPrimarySourceDiscrepancy,/Sochi/);
  assert.equal(byYear['2024/25'].sourceReportedPlayedGoals.home,364);
  assert.equal(byYear['2024/25'].sourceReportedPlayedGoals.away,284);
});
test('evidence exports only aggregated counts, no raw club or match records',()=>{
  for(const item of evidence.seasons){
    assert.ok(!('matches' in item));
    assert.ok(!('fixtures' in item));
    assert.ok(!('matchRows' in item));
    assert.ok(!('sourceText' in item));
  }
  assert.match(evidence.technicalAwardRule,/NOT to played\/on-field goals/);
});
