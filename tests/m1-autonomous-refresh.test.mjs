import test from 'node:test';
import assert from 'node:assert/strict';
import {decideCurrentRefresh,sanitizeRefreshOutcome} from '../scripts/m1-autonomous-refresh.mjs';
const fields=['added','removed','modified','unchanged','score_changes',
  'status_changes','kickoff_changes','calendar_changes','name_changes',
  'source_id_changes','newly_confirmed_times','newly_finished','finished_regressions'];
function fixture(){
  const zeros=Object.fromEntries(fields.map(k=>[k,0]));
  const seasons=['2024/2025','2025/2026','2026/2027'].map(season=>
    ({season,...zeros,unchanged:240}));
  return {kind:'M1_PRIVATE_REVISION_PREVIEW',candidateRows:720,
    requiresReview:false,autoUpdatesEnabled:false,historicalAsOfVerified:false,
    seasons,changeCounts:{...zeros,unchanged:720,
      historical_train_or_holdout_changes:0}};
}
function change(r,season,kind){
  const p=r.seasons[season];p.unchanged--;p.modified++;
  r.changeCounts.unchanged--;r.changeCounts.modified++;
  r.changeCounts[kind]++;p[kind]++;
  r.requiresReview=true;
}
test('identical real baseline is no-op, not a hidden API update',()=>{
  assert.equal(decideCurrentRefresh(fixture()),'NO_CHANGE');
});
test('only confirmed current kickoff and planned-to-final are eligible for guarded SQL',()=>{
  const a=fixture();change(a,2,'newly_confirmed_times');
  a.changeCounts.kickoff_changes++;a.seasons[2].kickoff_changes++;
  assert.equal(decideCurrentRefresh(a),'SAFE_CURRENT_ONLY');
  const b=fixture();change(b,2,'newly_finished');
  for(const k of ['status_changes','score_changes']){b.changeCounts[k]++;b.seasons[2][k]++;}
  assert.equal(decideCurrentRefresh(b),'SAFE_CURRENT_ONLY');
  const c=fixture();change(c,2,'newly_confirmed_times');
  c.changeCounts.kickoff_changes++;c.seasons[2].kickoff_changes++;
  change(c,2,'newly_finished');
  for(const k of ['status_changes','score_changes']){c.changeCounts[k]++;c.seasons[2][k]++;}
  assert.equal(decideCurrentRefresh(c),'SAFE_CURRENT_ONLY');
});
test('holdout score, changed dates, duplicate/provider mapping and unsafe transitions stay private',()=>{
  for(const problem of [
    r=>{change(r,1,'score_changes');r.changeCounts.historical_train_or_holdout_changes=1;},
    r=>change(r,2,'calendar_changes'),
    r=>change(r,2,'status_changes'),
    r=>change(r,2,'score_changes'),
    r=>change(r,2,'kickoff_changes'),
    r=>{r.changeCounts.added=1;r.changeCounts.unchanged=719;
      r.seasons[2].added=1;r.seasons[2].unchanged=239;r.requiresReview=true;},
    r=>{change(r,2,'newly_finished');
      for(const k of ['score_changes','status_changes','kickoff_changes']){
        r.changeCounts[k]++;r.seasons[2][k]++;
      }},
    r=>{r.changeCounts.modified=1;r.changeCounts.unchanged=719;
      r.requiresReview=true;},
  ]){const r=fixture();problem(r);assert.equal(decideCurrentRefresh(r),'REVIEW_REQUIRED');}
});
test('unknown shape or invented as-of evidence fails closed',()=>{
  for(const update of [
    r=>{r.kind='WRONG';},r=>{r.autoUpdatesEnabled=true;},
    r=>{r.historicalAsOfVerified=true;},
    r=>{r.changeCounts.unchanged=721;},
    r=>{r.seasons=[];}
  ]){const r=fixture();update(r);assert.throws(()=>decideCurrentRefresh(r));}
});
test('successful refresh output exposes only bounded integers, not UUIDs or raw source data',()=>{
  const data={snapshot_id:'SENSITIVE_UUID',providerName:'SECRET',
    public_links:612,already_published:false,newly_confirmed_scheduled:1,
    scheduled_to_finished:1,historical_or_holdout_updates:0,
    automatic_refresh_enabled:false,historical_as_of_verified:false};
  const safe=sanitizeRefreshOutcome(data,'SAFE_CURRENT_ONLY');
  assert.equal(safe.outcome,'CURRENT_ONLY_APPLIED');
  assert.equal(safe.publicLinks,612);
  assert.ok(!JSON.stringify(safe).includes('SENSITIVE'));
  assert.ok(!JSON.stringify(safe).includes('SECRET'));
  for(const edit of [
    r=>{r.historical_or_holdout_updates=1;},
    r=>{r.already_published=true;},
    r=>{r.public_links=9999;},
    r=>{r.newly_confirmed_scheduled=0;r.scheduled_to_finished=0;},
    r=>{r.automatic_refresh_enabled=true;}
  ]){const bad={...data};edit(bad);assert.throws(()=>sanitizeRefreshOutcome(bad,'SAFE_CURRENT_ONLY'));}
});
