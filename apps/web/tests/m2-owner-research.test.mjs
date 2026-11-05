import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {summarizeM2OwnerEvidence} from '../lib/m2-owner-research.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const evidence=JSON.parse(read('../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json'));
const modify=change=>{const copy=structuredClone(evidence);change(copy);return copy;};

test('committed two-run train-only evidence is recorded, but never approved',()=>{
  const status=summarizeM2OwnerEvidence(evidence);
  assert.equal(status.state,'recorded');
  assert.deepEqual(status.runs,[41443294566,41443547849]);
  assert.equal(status.receipt.fittedModelSha256,
    'c4145f27d33eee3c77276ec78a838c491c226b80362588ce6c709869cad0b6f1');
  assert.deepEqual(Object.keys(status),['state','receipt','runs']);
  assert.equal(JSON.stringify(status).includes('holdoutRead'),false);
});

test('tampered, substituted, non-train-only or duplicated evidence fails closed',()=>{
  for(const bad of [
    modify(x=>{x.receipt.trainingMatches=239}),
    modify(x=>{x.receipt.externalSourceRechecked=true}),
    modify(x=>{x.receipt.sourceSha256='f'.repeat(64)}),
    modify(x=>{x.receiptSha256='f'.repeat(64)}),
    modify(x=>{x.runs[1].runId=x.runs[0].runId}),
    modify(x=>{x.runs[1].jobId=x.runs[0].jobId}),
    modify(x=>{x.runs[1].headSha='a'.repeat(40)}),
    modify(x=>{x.runs[1].conclusion='failure'}),
    modify(x=>{x.runs[0].privateRows=[]}),
    modify(x=>{x.extra='untrusted'})
  ])assert.deepEqual(summarizeM2OwnerEvidence(bad),
    {state:'invalid',receipt:null,runs:[]});
});

test('owner research route is dynamic, gated before reading and contains no mutation path',()=>{
  const route=read('../app/(console)/admin/research/page.tsx');
  assert.match(route,/export const dynamic='force-dynamic'/);
  const auth=route.indexOf('await requireOwner()');
  assert.ok(auth>=0&&auth<route.indexOf('summarizeM2OwnerEvidence('));
  assert.ok(auth<route.indexOf('readM2TrainOnlyRun()'));
  assert.ok(auth<route.indexOf('readM2PublicSourcesRun()'));
  assert.ok(auth<route.indexOf('readM2OpenFootballTrainRun()'));
  assert.match(route,/m2-openfootball-train-only\.yml/);
  assert.match(route,/m2-public-sources-observe\.yml/);
  assert.match(route,/но не доступность/);
  assert.match(route,/M2CandidateReplay/);
  assert.match(route,/ResearchLockViewer/);
  assert.match(route,/non-strict retrospective/);
  assert.match(route,/holdout/);
  assert.doesNotMatch(route,/createClient\s*\(|service_role|INSERT INTO|fetch\s*\(|server action/i);
});

test('accepted M2 owner UI shows authenticated browser acceptance without claiming non-owner browser proof',()=>{
  const route=read('../app/(console)/admin/research/page.tsx');
  assert.match(route,/Общий этап M2<\/span><strong>5\/8<\/strong>/);
  assert.match(route,/Вход владельца · GitHub OAuth/);
  assert.match(route,/Принят 05\.11\.2026/);
  assert.match(route,/вход под чужим GitHub не проверялся в браузере/i);
  assert.match(route,/Оценка holdout<\/span><strong>0<\/strong>/);
  assert.match(route,/Контрольный сезон 2025\/26 закрыт/);
});
