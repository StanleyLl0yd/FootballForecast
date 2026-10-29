import assert from 'node:assert/strict';
import {test} from 'node:test';
import {verifyHistoricalPublisherScoreConsistency} from '../scripts/m1-openfootball-score-gate.mjs';

function report(){
  return {
    season:'2024/2025',kind:'M0_SOURCE_REPORTED_MATCH_BY_MATCH_CROSSCHECK',
    compared:240,referenceCount:240,matchedDirectedFixtures:240,
    missingFromPublisher:0,missingFromOpenFootball:0,
    dateSourceErrors:0,structuralSourceErrors:0,referenceAwardedGames:0,
    differingFields:{date:0,homeGoals:0,awayGoals:0,resultType:0},
    mismatchedFixtures:0,
    footbolnoCsvSHA256:'a'.repeat(64),
    openFootballGitBlob:'b'.repeat(40),
    observedPublisherAndOpenFootballAgreement:true
  };
}
test('full 240-match scored RPL fixture comparison passes without claiming upstream independence',()=>{
  const r=verifyHistoricalPublisherScoreConsistency(report());
  assert.equal(r.scoreAndTypeConsistencyPass,true);
  assert.equal(r.compared,240);
  assert.equal(r.dateConflictsForSeparateReview,0);
  assert.equal(r.originalPrematchPublicationTimeVerified,false);
  assert.equal(r.holdoutEvaluated,false);
  assert.ok(!JSON.stringify(r).includes('sourceMatchId'));
});
test('day-only mismatches are disclosed separately, not incorrectly converted to score changes',()=>{
  const e=report();
  e.differingFields.date=2;
  e.mismatchedFixtures=2;
  e.observedPublisherAndOpenFootballAgreement=false;
  const r=verifyHistoricalPublisherScoreConsistency(e);
  assert.equal(r.dateConflictsForSeparateReview,2);
  assert.equal(r.scoreAndTypeConsistencyPass,true);
});
test('missing coverage, untrusted digests, score and administrative conflicts refuse promotion',()=>{
  for(const corrupt of [
    e=>e.compared=239,
    e=>e.referenceCount=239,
    e=>e.matchedDirectedFixtures=239,
    e=>e.missingFromPublisher=1,
    e=>e.missingFromOpenFootball=1,
    e=>e.dateSourceErrors=1,
    e=>e.structuralSourceErrors=1,
    e=>e.referenceAwardedGames=1,
    e=>e.differingFields.homeGoals=1,
    e=>e.differingFields.awayGoals=1,
    e=>e.differingFields.resultType=1,
    e=>e.differingFields.date=-1,
    e=>e.differingFields.date=1,
    e=>e.footbolnoCsvSHA256='invalid',
    e=>e.openFootballGitBlob='bad',
    e=>e.season='2025/2026',
    e=>e.kind='OTHER'
  ]){
    const e=report();corrupt(e);
    assert.throws(()=>verifyHistoricalPublisherScoreConsistency(e),
      /M1 OpenFootball source comparison refused/);
  }
});
