import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateSourceEvidence} from '../scripts/m0-multi-source-quality.mjs';

const iso=d=>`2025-01-${String(d).padStart(2,'0')}T12:00:00Z`;
const observed='2026-10-19T12:00:00Z';
function sample(n=3){
  return {schemaVersion:1,cases:Array.from({length:n},(_,i)=>{
    const day=i+1,official={homeId:`H${day}`,awayId:`A${day}`,
      kickoffAt:iso(day),status:'played',homeGoals:2,awayGoals:1};
    const make=(sourceId,override={})=>({sourceId,publisherGroup:'publisher-one',
      publishedAt:null,observedAt:observed,...official,...override});
    return {key:`fixture-${day}`,officialEvidenceUrl:`https://example.org/match/${day}`,
      official,observations:[
        make('footbolno'),
        make('openfootball-europe',day===1?{homeId:official.awayId,awayId:official.homeId}:{}),
        ...(day===3?[]:[make('championat',{homeGoals:day===2?3:2,publisherGroup:null})])
      ]};
  })};
}

test('report does not certify supplied data and counts orientation, errors, coverage',()=>{
  const report=evaluateSourceEvidence(sample(),{minimumScoredMatches:2});
  const byId=Object.fromEntries(report.sources.map(x=>[x.sourceId,x]));
  assert.equal(report.observationCount,3);
  for(const flag of ['sourceApproval','sourceRightsApproved','officialReferenceAuthenticityVerified',
    'upstreamIndependenceVerified','enabledForTraining','eligibleForProduction'])
    assert.equal(report[flag],false,flag);
  assert.equal(byId.footbolno.finalScore.compared,3);
  assert.equal(byId.footbolno.finalScore.errorRate,0);
  assert.ok(byId.footbolno.finalScore.interval95.upper>0);
  assert.equal(byId['openfootball-europe'].matchOrientation.errors,1);
  assert.equal(byId['openfootball-europe'].finalScore.compared,2);
  assert.equal(byId['openfootball-europe'].unscoredFinals,1);
  assert.equal(byId.footbolno.fixtureIntegrity.compared,3);
  assert.equal(byId.footbolno.fixtureIntegrity.errors,0);
  assert.equal(byId['openfootball-europe'].fixtureIntegrity.errors,1);
  assert.equal(byId.championat.fixtureIntegrity.errors,2);
  assert.equal(report.fieldRankings.fixtureIntegrity[0].sourceId,'footbolno');
  assert.equal(byId.championat.missing,1);
  assert.equal(byId.championat.finalScore.errors,1);
  assert.equal(byId.championat.finalScore.compared,2);
  assert.equal(byId.championat.finalScore.errorRate,0.5);
  assert.equal(byId.championat.upstream.unresolvedObservations,2);
  assert.deepEqual(byId.footbolno.upstream.declaredGroups,['publisher-one']);
  assert.equal(byId.footbolno.temporalAvailability.demonstratedBySuppliedTimestamps,0);
  assert.ok(byId.footbolno.provisionalScoreRankEligible);
  assert.equal(report.fieldRankings.finalScore[0].sourceId,'footbolno');
  assert.equal(report.fieldRankings.matchOrientation.length,3);
});

test('tiny samples never get ranked and Wilson intervals are never exactly certain',()=>{
  const report=evaluateSourceEvidence(sample(2));
  assert.ok(report.sources.every(x=>!x.provisionalScoreRankEligible));
  assert.equal(report.fieldRankings.fixtureIntegrity.length,0);
  assert.equal(report.fieldRankings.finalScore.length,0);
  assert.ok(report.sources.every(x=>x.finalScore.interval95!==null));
});

test('postponed matches have no score accuracy denominator and invalid goals reject',()=>{
  const input=sample(1),c=input.cases[0];
  c.official.status='postponed';c.official.homeGoals=null;c.official.awayGoals=null;
  for(const o of c.observations){o.status='postponed';o.homeGoals=null;o.awayGoals=null}
  const r=evaluateSourceEvidence(input,{minimumScoredMatches:1});
  assert.ok(r.sources.every(s=>s.finalScore.compared===0&&s.finalScore.errorRate===null));
  c.observations[0].homeGoals=0;
  assert.throws(()=>evaluateSourceEvidence(input),/null scores/);
});

test('duplicates, unknown sources, time travel and impossible score/status fail closed',()=>{
  let v=sample();v.cases.push({...v.cases[0]});
  assert.throws(()=>evaluateSourceEvidence(v),/key duplicated/);
  v=sample();v.cases[0].observations.push({...v.cases[0].observations[0]});
  assert.throws(()=>evaluateSourceEvidence(v),/duplicate source snapshot/);
  v=sample();v.cases[0].observations[0].observedAt='2025-01-01T00:00:00Z';
  assert.throws(()=>evaluateSourceEvidence(v),/finished match observed before kickoff/);
  v=sample();v.cases[0].observations[0].publishedAt='2027-01-01T00:00:00Z';
  assert.throws(()=>evaluateSourceEvidence(v),/publication follows observation/);
  v=sample();v.cases[0].official.kickoffAt='2025-02-30T12:00:00Z';
  assert.throws(()=>evaluateSourceEvidence(v),/invalid kickoff/);
  v=sample();v.cases[0].observations[0].sourceId='unknown-paid-api';
  assert.throws(()=>evaluateSourceEvidence(v),/zero-cost source registry/);
  v=sample();v.cases[0].observations[0].status='scheduled';
  assert.throws(()=>evaluateSourceEvidence(v),/invalid status/);
  v=sample();v.cases[0].observations[0].homeGoals=100;
  assert.throws(()=>evaluateSourceEvidence(v),/scores/);
  v=sample();v.cases[0].officialEvidenceUrl='ftp://bad';
  assert.throws(()=>evaluateSourceEvidence(v),/primary evidence URL/);
});

test('revisions from the same publisher cannot masquerade as independent sources',()=>{
  const v=sample(1),obs=v.cases[0].observations[0];
  v.cases[0].observations.push({...obs,observedAt:'2026-10-19T14:00:00Z'});
  assert.throws(()=>evaluateSourceEvidence(v),/duplicate source snapshot/);
});

test('empty evidence does not fabricate measured precision or activate providers',()=>{
  assert.deepEqual(evaluateSourceEvidence({schemaVersion:1,cases:[]}).sources,[]);
  assert.throws(()=>evaluateSourceEvidence({schemaVersion:1,cases:[]},{minimumScoredMatches:0}),RangeError);
});

test('seeded 20-match perturbations preserve accounting and field error boundaries',()=>{
  let state=0x7e57;
  const rand=()=>((state=Math.imul(1664525,state)+1013904223|0)>>>0)/2**32;
  const input=sample(20);
  for(const c of input.cases){
    if(rand()<.25)c.observations[0].homeGoals=3;
    if(rand()<.25){const o=c.observations[1];[o.homeId,o.awayId]=[o.awayId,o.homeId]}
    if(rand()<.20)c.observations=c.observations.filter(o=>o.sourceId!=='championat');
  }
  const report=evaluateSourceEvidence(input,{minimumScoredMatches:10});
  for(const s of report.sources){
    assert.equal(s.observed+s.missing,20);
    assert.equal(s.fixtureIntegrity.compared,20);
    assert.ok(s.fixtureIntegrity.errors>=s.missing);
    assert.ok(s.finalScore.compared<=s.observed);
    assert.ok(s.finalScore.errors<=s.finalScore.compared);
    assert.ok(s.finalScore.errorRate===null||(s.finalScore.errorRate>=0&&s.finalScore.errorRate<=1));
  }
});
