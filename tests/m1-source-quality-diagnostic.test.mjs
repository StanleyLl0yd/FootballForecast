import assert from 'node:assert/strict';
import test from 'node:test';
import {formatFootbolnoQualityFailure} from '../scripts/m1-source-quality-diagnostic.mjs';

const quality={kind:'M1_PRIVATE_RPL_DATASET',quality:{'2026/2027':{
  role:'current',ready:false,structural:true,rows:240,quarantined:1,
  staleScheduled:0,live:1,cancelled:0,postponed:0,awarded:0,
  futureFinished:0,invalidDates:0,invalidScores:0,unconfirmedFinished:0
}}};
test('unsettled live status is distinguishable from stale scheduled',()=>{
  const report=JSON.parse(formatFootbolnoQualityFailure(quality)
    .replace(/^M1_SOURCE_QUALITY_REJECTED /,''));
  assert.equal(report.currentSeasonReady,false);
  assert.equal(report.currentSeasonStructural,true);
  assert.equal(report.currentSeasonRows,240);
  assert.equal(report.currentSeason.live,1);
  assert.equal(report.currentSeason.staleScheduled,0);
  assert.equal(report.currentSeason.quarantined,1);
});
test('adversarial quality reports cannot echo raw provider data',()=>{
  const secret='PRIVATE_SOURCE_CONTENT_DO_NOT_ECHO';
  for(const bad of [null,{}, {kind:'WRONG',quality:quality.quality},
    {kind:'M1_PRIVATE_RPL_DATASET',quality:{'2026/2027':secret}}]){
    assert.equal(formatFootbolnoQualityFailure(bad),
      'M1_SOURCE_QUALITY_REJECTED: aggregate quality report unavailable');
  }
  const changed=structuredClone(quality);
  changed.quality['2026/2027'].live=secret;
  changed.quality['2026/2027'].extra=secret;
  const report=formatFootbolnoQualityFailure(changed);
  assert.doesNotMatch(report,/PRIVATE_SOURCE_CONTENT_DO_NOT_ECHO/);
  assert.equal(JSON.parse(report.replace(/^M1_SOURCE_QUALITY_REJECTED /,'')).currentSeason.live,null);
});
test('invalid counts are replaced with null, never rendered as arbitrary content',()=>{
  for(const v of [-1,241,Infinity,NaN,1.5,'2']){
    const changed=structuredClone(quality);
    changed.quality['2026/2027'].quarantined=v;
    const report=JSON.parse(formatFootbolnoQualityFailure(changed)
      .replace(/^M1_SOURCE_QUALITY_REJECTED /,''));
    assert.equal(report.currentSeason.quarantined,null);
  }
});
