import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM2FirstPrivateEvaluation} from '../lib/m2-first-eval-evidence.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const evidence=JSON.parse(read('../../../docs/M2_FIRST_PRIVATE_EVALUATION_EVIDENCE.json'));
const mutate=change=>{const copy=structuredClone(evidence);change(copy);return copy;};

test('exact first private M2 score receipt verified without publishing scores or labels',()=>{
  const value=inspectM2FirstPrivateEvaluation(evidence);
  assert.equal(value.state,'recorded');
  assert.equal(value.runId,42590191735);
  assert.deepEqual(value.counts,{total:240,eligible:182,abstentions:58});
  assert.equal(value.privateMetrics,true);
  assert.equal(value.irreversible,true);
  assert.equal(value.bitwiseReplayPossible,false);
  assert.equal(value.sourceSha256,
    '433389a0e6cab9d84c519fdf5195994b86cc92687acefe10920b1d06eaacaf7b');
  assert.equal(evidence.receipt.productionForecastsWritten,0);
  assert.equal(evidence.receipt.oneUseReservationConsumed,true);
  assert.equal(evidence.constraints.metricsIncludedInPublicRepository,false);
  assert.equal(evidence.constraints.productionModelApproved,false);
  assert.equal(evidence.constraints.preMatchAsOfVerified,false);
  assert.equal(evidence.constraints.bookmakerSuperiorityProven,false);
  assert.equal(evidence.constraints.fullSourceBytesArchived,false);
  assert.equal(evidence.constraints.bitwiseIndependentReplayPossible,false);
  assert.equal(evidence.constraints.m3Authorized,false);
  for(const privateColumn of [
    'model_log_loss','model_brier','model_rps',
    'prior_log_loss','prior_brier','prior_rps',
    'model_top1_accuracy','prior_top1_accuracy',
    'home_goals','away_goals','model_bytes'
  ])assert.doesNotMatch(JSON.stringify(evidence),new RegExp(privateColumn));
});

test('public historical receipt fails closed on altered runner, study or DB witness',()=>{
  const mutations=[
    x=>{x.run.runId=42590191734;},
    x=>{x.run.conclusion='failure';},
    x=>{x.run.headSha='a'.repeat(40);},
    x=>{x.receipt.eligibleMatches=183;},
    x=>{x.receipt.abstentions=57;},
    x=>{x.receipt.sourceSha256='f'.repeat(64);},
    x=>{x.receipt.oneUseReservationConsumed=false;},
    x=>{x.receipt.codeSha='f'.repeat(40);},
    x=>{x.receiptSha256='0'.repeat(64);},
    x=>{x.receipt.holdoutLabels=[1,2,3];},
    x=>{x.databaseVerification.storedResults=2;},
    x=>{x.databaseVerification.publishedForecastCount=1;},
    x=>{x.databaseVerification.modelTuning=true;},
    x=>{x.constraints.fullSourceBytesArchived=true;},
    x=>{x.constraints.m3Authorized=true;},
    x=>{delete x.receipt.privateAggregateSha256;},
    x=>{x.extra='false claims';}
  ];
  for(const change of mutations){
    const result=inspectM2FirstPrivateEvaluation(mutate(change));
    assert.deepEqual(result,{state:'invalid',runId:null,counts:null});
  }
});

test('private M2 owner view shows scored evaluation only after authentication',()=>{
  const page=read('../app/(console)/admin/research/page.tsx');
  const owner=page.indexOf('await requireOwner()');
  assert.ok(owner>=0);
  assert.ok(owner<page.indexOf('inspectM2FirstPrivateEvaluation('));
  assert.match(page,/Общий этап M2<\/span><strong>7\/8<\/strong>/);
  assert.match(page,/Оценка 2025\/26/);
  assert.match(page,/182\/240/);
  assert.match(page,/58/);
  assert.match(page,/M2_FIRST_PRIVATE_EVALUATION_EVIDENCE\.json/);
  assert.match(page,/42590191735/);
  assert.match(page,/SHA полученного CSV и выборки зафиксированы после чтения/);
  assert.doesNotMatch(page,/SHA кода, модели, метода и источника/);
  assert.match(page,/без исходных матчей и коэффициентов/i);
  assert.match(page,/не сохранён целиком/i);
  assert.doesNotMatch(page,/Оценка holdout<\/span><strong>0<\/strong>/);
  assert.doesNotMatch(page,/Контрольный сезон 2025\/26 закрыт/);
  assert.doesNotMatch(page,/INSERT INTO|service_role|createClient\s*\(|server action/i);
});
