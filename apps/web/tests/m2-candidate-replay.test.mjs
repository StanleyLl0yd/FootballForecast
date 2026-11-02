import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM2StoredCandidate,compareM2StoredCandidates} from '../lib/m2-candidate-replay.mjs';

const valid=()=>({
  schemaVersion:1,
  kind:'M2_STORED_TRAIN_CANDIDATE',
  codeSha:'a'.repeat(40),
  sourceSha256:'b'.repeat(64),
  snapshotIdentitySha256:'c'.repeat(64),
  trainRowsSha256:'d'.repeat(64),
  clubMappingSha256:'e'.repeat(64),
  fittedModelSha256:'f'.repeat(64),
  trainingMatches:240,
  trainingClubs:16,
  storedTrainOnly:true,
  externalSourceRechecked:false,
  modelFitted:true,
  preHoldoutLockApproved:false,
  holdoutRead:false,
  historicalPrematchVerified:false,
  modelAccuracyEvaluated:false
});

test('two independently supplied train-only receipts have exactly six comparable digests',()=>{
  const result=compareM2StoredCandidates(valid(),{...valid()});
  assert.equal(result.equal,true);
  assert.deepEqual(result.mismatches,[]);
  assert.deepEqual(Object.keys(result.common),[
    'codeSha','sourceSha256','snapshotIdentitySha256','trainRowsSha256',
    'clubMappingSha256','fittedModelSha256'
  ]);
  assert.equal(result.common.fittedModelSha256,'f'.repeat(64));
  assert.doesNotMatch(JSON.stringify(result),/match_id|private_row|accuracy|approved":true/i);
});

test('differences in any of six identities are identified rather than treated as equal',()=>{
  const cases=[
    ['codeSha','b'.repeat(40)],['sourceSha256','c'.repeat(64)],
    ['snapshotIdentitySha256','d'.repeat(64)],['trainRowsSha256','e'.repeat(64)],
    ['clubMappingSha256','f'.repeat(64)],['fittedModelSha256','a'.repeat(64)]
  ];
  for(const [key,value] of cases){
    const result=compareM2StoredCandidates(valid(),{...valid(),[key]:value});
    assert.equal(result.equal,false,key);
    assert.deepEqual(result.mismatches,[key]);
    assert.equal(result.common,null);
  }
});

test('reject raw rows, extraneous fields, approved lock, opened holdout, invented metrics and false flags',()=>{
  const cases=[
    {rawFixtures:[{home_team_id:'private'}]},
    {__private:'raw'},
    {schemaVersion:2},{kind:'M2_PRE_HOLDOUT_LOCK'},
    {trainingMatches:239},{trainingClubs:15},
    {storedTrainOnly:false},{externalSourceRechecked:true},
    {modelFitted:false},{preHoldoutLockApproved:true},{holdoutRead:true},
    {historicalPrematchVerified:true},{modelAccuracyEvaluated:true},
    {sourceSha256:'B'.repeat(64)},{codeSha:'b'.repeat(39)},
    {trainRowsSha256:''},{clubMappingSha256:null},
    {fittedModelSha256:'z'.repeat(64)}
  ];
  for(const change of cases){
    assert.throws(()=>inspectM2StoredCandidate({...valid(),...change}),JSON.stringify(change));
    assert.throws(()=>compareM2StoredCandidates(valid(),{...valid(),...change}));
  }
  for(const input of [null,[],false,'',{foo:'bar'}]){
    assert.throws(()=>inspectM2StoredCandidate(input));
  }
});

test('browser viewer remains local-only, read-only and describes identity proof limitations',()=>{
  const component=readFileSync(new URL('../components/m2-candidate-replay.tsx',import.meta.url),'utf8');
  const page=readFileSync(new URL('../app/(console)/models/page.tsx',import.meta.url),'utf8');
  assert.match(component,/file\.arrayBuffer\(\)/);
  assert.match(component,/TextDecoder\('utf-8',\{fatal:true\}\)/);
  assert.match(component,/не подтверждает подлинность GitHub Actions/);
  assert.match(component,/Запрещено открывать 2025\/26 holdout/);
  assert.doesNotMatch(component,/\bfetch\s*\(|\blocalStorage\b|\bcreateClient\s*\(|\bpostMessage\s*\(/);
  assert.match(page,/<M2CandidateReplay\/>/);
});
