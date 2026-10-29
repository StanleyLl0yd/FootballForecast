import assert from 'node:assert/strict';
import test from 'node:test';
import {summarizeRevisionPreview} from '../scripts/m1-revision-report.mjs';

const fields=['added','removed','modified','unchanged','score_changes',
  'status_changes','kickoff_changes','calendar_changes','name_changes',
  'source_id_changes','newly_confirmed_times','newly_finished',
  'finished_regressions'];
function make(){
  const base=Object.fromEntries(fields.map(k=>[k,0]));
  const seasons=['2024/2025','2025/2026','2026/2027'].map(season=>
    ({season,...base,unchanged:240}));
  return {
    candidate_rows:720,requires_review:false,auto_updates_enabled:false,
    historical_as_of_verified:false,
    baseline_sha256:'a'.repeat(64),candidate_sha256:'b'.repeat(64),
    suspicious_upstream_record:'SECRET-NEVER-DISCLOSE',
    seasons,change_counts:{...base,unchanged:720,
      historical_train_or_holdout_changes:0}
  };
}

test('unchanged production-style snapshot is summarized without source identifiers or raw fields',()=>{
  const raw=make();
  const report=summarizeRevisionPreview(raw);
  assert.equal(report.kind,'M1_PRIVATE_REVISION_PREVIEW');
  assert.equal(report.candidateRows,720);
  assert.equal(report.requiresReview,false);
  assert.equal(report.publicWritesPerformed,0);
  assert.equal(report.rawProviderRecordsPrinted,0);
  assert.equal(report.seasons.length,3);
  const encoded=JSON.stringify(report);
  assert.ok(!encoded.includes('SECRET-NEVER-DISCLOSE'));
  assert.ok(!encoded.includes(raw.baseline_sha256));
  assert.ok(!encoded.includes(raw.candidate_sha256));
});

test('holdout score drift and newly confirmed current kickoff are independently flagged',()=>{
  const r=make();
  for(const [i,flag] of [[1,'score_changes'],[2,'newly_confirmed_times']]){
    r.seasons[i].unchanged=239;
    r.seasons[i].modified=1;
    r.seasons[i][flag]=1;
  }
  r.seasons[2].kickoff_changes=1;
  r.change_counts.unchanged=718;
  r.change_counts.modified=2;
  r.change_counts.score_changes=1;
  r.change_counts.kickoff_changes=1;
  r.change_counts.newly_confirmed_times=1;
  r.change_counts.historical_train_or_holdout_changes=1;
  r.requires_review=true;
  const report=summarizeRevisionPreview(r);
  assert.equal(report.changeCounts.modified,2);
  assert.equal(report.changeCounts.historical_train_or_holdout_changes,1);
  assert.equal(report.seasons[2].newly_confirmed_times,1);
  assert.equal(report.requiresReview,true);
});

test('fail closed on unknown season, false counts, invented updates and historical-as-of claim',()=>{
  for(const edit of [
    r=>{r.seasons[1].season='2023/2024';},
    r=>{r.change_counts.modified=1;},
    r=>{r.seasons[0].unchanged=239;},
    r=>{r.change_counts.score_changes=1;},
    r=>{r.change_counts.added=-1;},
    r=>{r.change_counts.historical_train_or_holdout_changes=1;},
    r=>{r.auto_updates_enabled=true;},
    r=>{r.historical_as_of_verified=true;},
    r=>{r.requires_review=true;},
    r=>{r.candidate_rows=721;},
    r=>{r.seasons=[];}
  ]){
    const r=make();edit(r);
    assert.throws(()=>summarizeRevisionPreview(r),/Revision summary invalid/);
  }
});
