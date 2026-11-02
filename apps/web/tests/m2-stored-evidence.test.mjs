import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM2StoredCandidate,compareM2StoredCandidates} from '../lib/m2-candidate-replay.mjs';

const evidence=JSON.parse(readFileSync(
  new URL('../../../docs/M2_STORED_TRAIN_REPLAY_EVIDENCE.json',import.meta.url),'utf8'
));

test('pinned, independently logged train-only receipts have an exact aggregate schema',()=>{
  assert.deepEqual(Object.keys(evidence),[
    'schemaVersion','kind','researchClassification','observedAtDate',
    'receiptSha256','receipt','runs'
  ]);
  assert.equal(evidence.schemaVersion,1);
  assert.equal(evidence.kind,'M2_STORED_TRAIN_REPLAY_EVIDENCE');
  assert.equal(evidence.researchClassification,'TRAIN_ONLY_UNAPPROVED');
  assert.equal(evidence.observedAtDate,'2026-11-02');
  const validated=inspectM2StoredCandidate(evidence.receipt);
  assert.equal(evidence.receipt.trainingMatches,240);
  assert.equal(evidence.receipt.trainingClubs,16);
  assert.equal(evidence.receipt.preHoldoutLockApproved,false);
  assert.equal(evidence.receipt.holdoutRead,false);
  assert.equal(evidence.receipt.externalSourceRechecked,false);
  assert.equal(evidence.receipt.modelAccuracyEvaluated,false);
  assert.equal(compareM2StoredCandidates(evidence.receipt,evidence.receipt).equal,true);
  assert.equal(Object.keys(validated).length,6);
  const bytes=JSON.stringify(evidence.receipt)+'\n';
  assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.receiptSha256);
  assert.equal(evidence.receiptSha256,
    '56d7ca8b1e40832718b971dd857bc51bf4a7c3146ec98ebbeb481374b348b36e');
});

test('both successful run identities refer to distinct exact protected-code jobs',()=>{
  assert.deepEqual(evidence.runs.map(run=>run.runId),[41443294566,41443547849]);
  assert.deepEqual(evidence.runs.map(run=>run.jobId),[125270173806,125271011636]);
  assert.equal(new Set(evidence.runs.map(run=>run.runId)).size,2);
  assert.equal(new Set(evidence.runs.map(run=>run.jobId)).size,2);
  for(const run of evidence.runs){
    assert.deepEqual(Object.keys(run),['runId','jobId','headSha','event','conclusion']);
    assert.equal(run.headSha,evidence.receipt.codeSha);
    assert.equal(run.event,'issue_comment');
    assert.equal(run.conclusion,'success');
  }
  assert.equal(evidence.receipt.codeSha,'34570293d603d63fadd0f31cda34e88fb4ee9c4f');
});

test('public report and models panel do not embed match rows or imply an approved source lock',()=>{
  const rendered=JSON.stringify(evidence);
  assert.doesNotMatch(rendered,/home_goals|away_goals|home_team_id|away_team_id|match_id|fixtureRows|coefficients|password|service_role/i);
  const page=readFileSync(new URL('../app/(console)/models/page.tsx',import.meta.url),'utf8');
  assert.match(page,/storedReplayEvidence\.receipt\.fittedModelSha256/);
  assert.match(page,/storedReplayEvidence\.receiptSha256/);
  assert.match(page,/storedReplayEvidence\.runs\.map/);
  assert.match(page,/не утверждённая модель/);
  assert.match(page,/holdout 2025\/26/);
  assert.doesNotMatch(page,/createClient\s*\(|\bpostMessage\b|\bwriteFile\b/);
});
