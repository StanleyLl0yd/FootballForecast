import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM2OpenFootballReplay} from '../lib/m2-openfootball-evidence.mjs';

const evidence=JSON.parse(readFileSync(new URL(
  '../../../docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json',import.meta.url),'utf8'));
const modify=fn=>{const value=structuredClone(evidence);fn(value);return value;};

test('two exact protected public-source runs reproduce a non-authorizing train-only receipt',()=>{
  const result=inspectM2OpenFootballReplay(evidence);
  assert.equal(result.state,'recorded');
  assert.deepEqual(result.runs,[41601074078,41601164752]);
  assert.equal(result.receipt.trainingMatches,240);
  assert.equal(result.receipt.trainingClubs,16);
  assert.deepEqual([
    result.receipt.homeWins,result.receipt.draws,result.receipt.awayWins],[103,65,72]);
  assert.equal(result.receipt.fittedModelSha256,
    '987caad53cf77e4977482b4e9750b2c779912b47d0bc884cfb3807e8151ad95d');
  assert.equal(result.receipt.receiptSha256,
    '381159c8928283c6f3d9a2b75bda4ee53d1b9a41f31184d5cd9a14ec267306b6');
  for(const field of ['modelApproved','holdoutRead','privateModelPersisted','privateRows',
    'teams','coefficients'])assert.equal(Object.hasOwn(result.receipt,field),false);
});
test('tampered source, outcome, run, fit, new fields or old study denied',()=>{
  const invalid={state:'invalid',receipt:null,runs:[]};
  for(const candidate of [
    modify(x=>{x.receipt.trainingMatches=239}),
    modify(x=>{x.receipt.trainOutcomeCountsHDA=[104,65,71]}),
    modify(x=>{x.receipt.sourceBytesSha256='f'.repeat(64)}),
    modify(x=>{x.receipt.holdoutRead=true}),
    modify(x=>{x.receipt.privateModelPersisted=true}),
    modify(x=>{x.receipt.protocol='m2-independent-poisson-v1'}),
    modify(x=>{x.receipt.trainRowsSha256='f'.repeat(64)}),
    modify(x=>{x.receipt.teamNames=['PRIVATE']}),
    modify(x=>{x.receiptSha256='f'.repeat(64)}),
    modify(x=>{x.runs[1].jobId=x.runs[0].jobId}),
    modify(x=>{x.runs[0].headSha='a'.repeat(40)}),
    modify(x=>{x.runs[0].conclusion='failure'}),
    modify(x=>{x.observedAtDate='2026-11-02'}),
    modify(x=>{x.anything='unauthorized'})
  ])assert.deepEqual(inspectM2OpenFootballReplay(candidate),invalid);
});
test('owner route reads new recorded evidence only after mandatory owner login',()=>{
  const route=readFileSync(new URL('../app/(console)/admin/research/page.tsx',
    import.meta.url),'utf8');
  const auth=route.indexOf('await requireOwner()');
  assert.ok(auth>0&&auth<route.indexOf('inspectM2OpenFootballReplay('));
  assert.match(route,/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE\.json/);
  assert.match(route,/TRAIN_ONLY_UNAPPROVED|не утвержд|не одобр/);
  assert.doesNotMatch(route,/database\.insert|service_role|createClient\s*\(/);
});
