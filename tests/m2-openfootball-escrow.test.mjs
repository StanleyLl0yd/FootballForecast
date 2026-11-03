import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectPrivateOpenFootballEscrow} from '../scripts/m2-openfootball-escrow-validate.mjs';

const evidence=JSON.parse(readFileSync(
  new URL('../docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json',import.meta.url)));
const CODE='b'.repeat(40),RUN=123456789;
const receipt=()=>({
  schemaVersion:1,kind:'M2_OPENFOOTBALL_PRIVATE_TRAIN_ONLY_ESCROW',
  protocol:'m2-openfootball-calendar-v1',
  sourceCommit:'63df627f3c87ce71708f016522ea236cf74332c3',
  sourceGitBlobSha1:'6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
  sourceBytesSha256:evidence.receipt.sourceBytesSha256,codeSha:CODE,
  trainRowsSha256:evidence.receipt.trainRowsSha256,
  clubMappingSha256:evidence.receipt.clubMappingSha256,
  fittedModelSha256:evidence.receipt.fittedModelSha256,
  modelArtifactSha256:'a'.repeat(64),trainingMatches:240,trainingClubs:16,
  githubRunId:RUN,researchState:'TRAIN_ONLY_UNAPPROVED',holdoutRead:false,
  modelApproved:false,productionForecastsWritten:0,footbolnoRequired:false,
  storedRunId:RUN,insertedByThisRun:true,privateModelStored:true,
  databaseDigestVerified:true,immutableStudyLockApproved:false,
  holdoutEvaluationPermitted:false
});
const inspect=x=>inspectPrivateOpenFootballEscrow(x,evidence.receipt,{codeSha:CODE,runId:RUN});
test('locked model digest receipt is public-safe and never a holdout authorization',()=>{
  const result=inspect(receipt());
  assert.equal(result.privateModelStored,true);
  assert.equal(result.modelApproved,false);
  assert.equal(result.holdoutRead,false);
  assert.equal(result.fittedModelSha256,evidence.receipt.fittedModelSha256);
  assert.doesNotMatch(JSON.stringify(result),/S_[A-F0-9]{20}|attack|defence/);
});
test('private escrow rejects source, model, code, run, approval or extra fields',()=>{
  const bad=mutate=>{const x=receipt();mutate(x);
    assert.throws(()=>inspect(x),/unverified/);};
  bad(x=>{x.sourceBytesSha256='f'.repeat(64)});
  bad(x=>{x.trainRowsSha256='f'.repeat(64)});
  bad(x=>{x.fittedModelSha256='f'.repeat(64)});
  bad(x=>{x.codeSha='f'.repeat(40)});
  bad(x=>{x.githubRunId=RUN+1});
  bad(x=>{x.modelArtifactSha256='wrong'});
  bad(x=>{x.trainingMatches=239});
  bad(x=>{x.privateModelStored=false});
  bad(x=>{x.modelApproved=true});
  bad(x=>{x.holdoutRead=true});
  bad(x=>{x.immutableStudyLockApproved=true});
  bad(x=>{x.holdoutEvaluationPermitted=true});
  bad(x=>{x.secret='credential'});
  bad(x=>{delete x.databaseDigestVerified});
});
test('owner-only protected escrow job cannot query holdout or publish model bytes',()=>{
  const workflow=readFileSync(
    new URL('../.github/workflows/m2-openfootball-train-only.yml',import.meta.url),'utf8');
  const job=workflow.slice(workflow.indexOf('  calendar-escrow:'));
  assert.ok(job.startsWith('  calendar-escrow:'));
  for(const s of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.confirmation == 'OPENFOOTBALL_ESCROW_TRAIN_ONLY'",
    "github.event.issue.number == 182",
    "github.event.comment.body == '/m2-openfootball-escrow'",
    "github.event.comment.author_association == 'OWNER'",
    'environment: m1-source-import','permissions: {contents: read}',
    'persist-credentials: false','timeout-minutes: 10',
    'scripts/m2-openfootball-escrow-run.sh',
  ])assert.ok(job.includes(s)||workflow.includes(s),s);
  assert.doesNotMatch(job,/upload-artifact|git push|curl -L|--location|FF_M1_DB_WRITE_ENABLED/);
  const script=readFileSync(
    new URL('../scripts/m2-openfootball-escrow-run.sh',import.meta.url),'utf8');
  assert.match(script,/raw\.githubusercontent\.com\/openfootball\/europe\/63df627f/);
  assert.match(script,/m2-openfootball-training\.mjs/);
  assert.match(script,/m2-openfootball-escrow-validate\.mjs/);
  assert.match(script,/PYTHONDONTWRITEBYTECODE=1/);
  assert.doesNotMatch(script,/footbolno\.ru|2025\/2026|upload-artifact|curl -L|--location|set -x/);
});
