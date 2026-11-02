import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM2PendingAnchorRequest} from '../lib/m2-anchor-request-viewer.mjs';

const sample=()=>({
  schemaVersion:1,kind:'M2_STUDY_ANCHOR_REQUEST',
  reviewState:'PENDING_INDEPENDENT_REVIEW',
  holdoutAccessAuthorized:false,holdoutRead:false,
  researchClassification:'NON_STRICT_RETROSPECTIVE',
  repository:'StanleyLl0yd/FootballForecast',protectedRef:'refs/heads/main',
  protocol:'m2-independent-poisson-v1',codeSha:'a'.repeat(40),
  sourceSha256:'b'.repeat(64),
  openFootballReferenceBlob:'6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
  snapshotIdentitySha256:'c'.repeat(64),trainRowsSha256:'d'.repeat(64),
  clubMappingSha256:'e'.repeat(64),fittedModelSha256:'f'.repeat(64),
  trainingAttestationCanonicalSha256:'1'.repeat(64),
  sourceComparisonCanonicalSha256:'2'.repeat(64),
  workflowRunId:123,workflowJobId:456,workflowHeadSha:'a'.repeat(40),
  runnerImageSha256:'3'.repeat(64),dependencyManifestSha256:'4'.repeat(64),
  privateModelArtifactSha256:'5'.repeat(64)
});

test('only a pending, SHA-consistent 24-field synthetic request is locally inspectable',()=>{
  const status=inspectM2PendingAnchorRequest(sample());
  assert.equal(status.state,'pending');
  assert.equal(status.workflowRunId,123);
  assert.equal(status.codeSha,'a'.repeat(40));
  assert.equal(status.privateModelArtifactSha256,'5'.repeat(64));
  assert.deepEqual(Object.keys(status),[
    'state','codeSha','sourceSha256','fittedModelSha256',
    'trainingAttestationCanonicalSha256','sourceComparisonCanonicalSha256',
    'runnerImageSha256','dependencyManifestSha256',
    'privateModelArtifactSha256','workflowRunId','workflowJobId'
  ]);
  assert.equal(JSON.stringify(status).includes('holdoutAccessAuthorized'),false);
});

test('fake approval, holdout access, identity substitution or private extras fail closed',()=>{
  const patches=[
    {reviewState:'APPROVED'}, {holdoutAccessAuthorized:true},
    {holdoutRead:true}, {researchClassification:'STRICT_AS_OF'},
    {repository:'attacker/repo'}, {protectedRef:'refs/heads/dev'},
    {protocol:'custom'}, {workflowHeadSha:'f'.repeat(40)},
    {codeSha:'g'.repeat(40)}, {workflowRunId:true}, {workflowJobId:0},
    {sourceComparisonCanonicalSha256:'f'.repeat(63)},
    {privateModelArtifactSha256:null}, {trainingMatches:240},
    {modelCoefficients:[]}, {privateTrainingRows:[]},
    {openFootballReferenceBlob:'f'.repeat(40)}
  ];
  for(const patch of patches)
    assert.throws(()=>inspectM2PendingAnchorRequest({...sample(),...patch}),
      /Недопустимый запрос/);
  for(const invalid of [null,[],{},42,'{}'])
    assert.throws(()=>inspectM2PendingAnchorRequest(invalid),/Недопустимый запрос/);
});

test('invalid hashes and every unexpected digest type are rejected',()=>{
  for(const key of [
    'sourceSha256','snapshotIdentitySha256','trainRowsSha256',
    'clubMappingSha256','fittedModelSha256','trainingAttestationCanonicalSha256',
    'sourceComparisonCanonicalSha256','runnerImageSha256',
    'dependencyManifestSha256','privateModelArtifactSha256'
  ]){
    assert.throws(()=>inspectM2PendingAnchorRequest({...sample(),[key]:'F'.repeat(64)}),
      /Недопустимый запрос/);
  }
});


test('browser schema stays in lockstep with Python pre-anchor request producer',()=>{
  const python=readFileSync(new URL('../../../ml/src/football_forecast/research/anchor.py',import.meta.url),'utf8');
  const tail=python.split('    return {\n').at(-1);
  assert.ok(tail!==python,'Python anchor request dictionary must exist');
  const emitted=[...tail.matchAll(/^        "([A-Za-z0-9]+)":/gm)].map(match=>match[1]);
  assert.equal(emitted.length,24,'Python request schema changed; review browser allowlist');
  assert.deepEqual(new Set(Object.keys(sample())),new Set(emitted));
});

test('pending request inspector is guarded by owner authorization and has no server write path',()=>{
  const route=readFileSync(new URL('../app/(console)/admin/research/page.tsx',import.meta.url),'utf8');
  const auth=route.indexOf('await requireOwner()');
  assert.ok(auth>0&&auth<route.indexOf('readM2TrainOnlyRun()'));
  assert.match(route,/M2AnchorRequestViewer/);
  const component=readFileSync(new URL('../components/m2-anchor-request-viewer.tsx',import.meta.url),'utf8');
  assert.match(component,/'use client'/);
  assert.match(component,/file\.arrayBuffer\(\)/);
  assert.doesNotMatch(component,/fetch\s*\(|service_role|formAction=|action=|upload-artifact/);
});
