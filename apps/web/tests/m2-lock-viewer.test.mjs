import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectM2PreHoldoutLock} from '../lib/m2-lock-viewer.mjs';

const valid=()=>({
  schemaVersion:1,
  kind:'M2_PRE_HOLDOUT_LOCK',
  protocol:'m2-independent-poisson-v1',
  codeSha:'a'.repeat(40),
  sourceSha256:'b'.repeat(64),
  snapshotIdentitySha256:'c'.repeat(64),
  trainRowsSha256:'d'.repeat(64),
  clubMappingSha256:'e'.repeat(64),
  fittedModelSha256:'f'.repeat(64),
  trainOutcomeCountsHDA:[100,60,80],
  trainingMatches:240,
  trainingClubs:16,
  researchClassification:'NON_STRICT_RETROSPECTIVE',
  holdoutRead:false,
  historicalPrematchVerified:false,
  modelAccuracyEvaluated:false
});

test('local M2 viewer accepts only digest/aggregate candidate and never claims independent verification',()=>{
  const parsed=inspectM2PreHoldoutLock(valid());
  assert.equal(parsed.trainingMatches,240);
  assert.equal(parsed.trainingClubs,16);
  assert.equal(parsed.homeWins+parsed.draws+parsed.awayWins,240);
  assert.equal(parsed.modelSha256,'f'.repeat(64));
  for(const name of Object.keys(parsed))
    assert.doesNotMatch(name,/fixture|goals|home_team|away_team|private|accuracy|verified/i);
});

test('reject unknown or raw fixture fields (fail closed)',()=>{
  assert.throws(()=>inspectM2PreHoldoutLock({...valid(),rawMatchIds:['secret']}));
  assert.throws(()=>inspectM2PreHoldoutLock({...valid(),__unsafe:'x'}));
  assert.throws(()=>inspectM2PreHoldoutLock([]));
  assert.throws(()=>inspectM2PreHoldoutLock(null));
});

test('reject malformed provenance, model identity, unsealed cohort and fabricated metrics',()=>{
  const mutations=[
    {schemaVersion:2},{kind:'M2_HOLDOUT_SCORE'}, {protocol:'experimental'},
    {codeSha:'a'.repeat(39)},{sourceSha256:'G'.repeat(64)},
    {snapshotIdentitySha256:'b'.repeat(63)}, {trainRowsSha256:''},
    {clubMappingSha256:null},{fittedModelSha256:'z'.repeat(64)},
    {researchClassification:'STRICT_BACKTEST'}, {holdoutRead:true},
    {historicalPrematchVerified:true},{modelAccuracyEvaluated:true},
    {trainingMatches:239},{trainingClubs:15},{trainOutcomeCountsHDA:[80,80,79]},
    {trainOutcomeCountsHDA:[100,-1,141]}, {trainOutcomeCountsHDA:[100,60,Infinity]},
    {trainOutcomeCountsHDA:[100,60,'80']}
  ];
  for(const update of mutations)
    assert.throws(()=>inspectM2PreHoldoutLock({...valid(),...update}),JSON.stringify(update));
});

test('training outcome order remains home/draw/away and never infers heldout labels',()=>{
  const parsed=inspectM2PreHoldoutLock({...valid(),trainOutcomeCountsHDA:[0,240,0]});
  assert.deepEqual([parsed.homeWins,parsed.draws,parsed.awayWins],[0,240,0]);
  assert.equal('holdout' in parsed,false);
});
