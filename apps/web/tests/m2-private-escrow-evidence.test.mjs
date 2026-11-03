import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectM2ProtectedPrivateEscrow} from '../lib/m2-private-escrow-evidence.mjs';

const read=name=>JSON.parse(readFileSync(new URL(
  '../../../docs/'+name,import.meta.url),'utf8'));
const e=read('M2_OPENFOOTBALL_PRIVATE_ESCROW_EVIDENCE.json');
const prior=read('M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json');
const inspect=(x,y=prior)=>inspectM2ProtectedPrivateEscrow(x,y);
const changed=fn=>{const v=structuredClone(e);fn(v);return v;};

test('protected real model stored after two independent replays, never approved',()=>{
  const x=inspect(e);
  assert.equal(x.state,'recorded');
  assert.equal(x.runId,41639171388);
  assert.equal(x.trainingMatches,240);
  assert.equal(x.trainingClubs,16);
  assert.equal(x.modelBytes,1447);
  assert.equal(x.privateModelStored,true);
  assert.equal(x.artifactSha256,
    '5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d');
  assert.equal(x.modelApproved,false);
  assert.equal(x.holdoutRead,false);
  assert.equal(x.immutableStudyLockApproved,false);
  assert.equal(x.productionIngestionApproved,false);
  assert.doesNotMatch(JSON.stringify(e),/S_[A-F0-9]{20}|privateRows|homeTeam|awayTeam|model_coefficients/i);
});

test('untrusted private model provenance, extra fields and false approval denied',()=>{
  const scenarios=[
    x=>{x.run.headSha='a'.repeat(40)},
    x=>{x.run.jobId=2},
    x=>{x.run.conclusion='failure'},
    x=>{x.receipt.codeSha='a'.repeat(40)},
    x=>{x.receipt.sourceBytesSha256='a'.repeat(64)},
    x=>{x.receipt.fittedModelSha256='a'.repeat(64)},
    x=>{x.receipt.modelArtifactSha256='a'.repeat(64)},
    x=>{x.receipt.privateModelStored=false},
    x=>{x.receipt.modelApproved=true},
    x=>{x.receipt.holdoutRead=true},
    x=>{x.receipt.immutableStudyLockApproved=true},
    x=>{x.receipt.productionForecastsWritten=1},
    x=>{x.receipt.teams=['PRIVATE']},
    x=>{x.databaseVerification.modelBytes=1500},
    x=>{x.databaseVerification.serviceRoleInsertDenied=false},
    x=>{x.databaseVerification.privateModelCount=2},
    x=>{x.databaseVerification.forceRls=false},
    x=>{x.gate.holdoutEvaluationPermitted=true},
    x=>{x.gate.productionIngestionApproved=true},
    x=>{x.receiptSha256='f'.repeat(64)},
    x=>{delete x.run.event},
    x=>{x.extra='credential'}
  ];
  for(const fn of scenarios)assert.deepEqual(inspect(changed(fn)),
    {state:'invalid',receipt:null,runId:null});
  const badPrior=structuredClone(prior);
  badPrior.receipt.trainingMatches=239;
  assert.equal(inspect(e,badPrior).state,'invalid');
  assert.equal(inspect(null).state,'invalid');
});

test('owner research page guards private escrow evidence and never exposes bytes',()=>{
  const page=readFileSync(new URL('../app/(console)/admin/research/page.tsx',
    import.meta.url),'utf8');
  const auth=page.indexOf('await requireOwner()');
  assert.ok(auth>0&&auth<page.indexOf('inspectM2ProtectedPrivateEscrow('));
  assert.match(page,/M2_OPENFOOTBALL_PRIVATE_ESCROW_EVIDENCE\.json/);
  assert.match(page,/TRAIN_ONLY_UNAPPROVED|не утвержд/);
  assert.doesNotMatch(page,/model_bytes|modelBytes\s*\.toString|database\.insert|service_role|createClient\s*\(/);
});
