import {createHash} from 'node:crypto';
import {inspectM2OpenFootballReplay} from './m2-openfootball-evidence.mjs';

const expected={
  runId:41639171388,jobId:125927962778,
  headSha:'a89c82ed02b1157ca935c573f25c93544ba299f1',
  modelArtifactSha256:'5d1893ac2d3e632f979b1ec67ed751edfa38733b9faf6371fc3f5e24b97fa28d',
  receiptSha256:'2d5a9a9f1d6f682f8bfc7b7c388eb184887b944288beac33080aeb8097d69bc9'
};
const ROOT=['schemaVersion','kind','researchClassification','observedAtDate',
  'run','receiptSha256','receipt','databaseVerification','gate'];
const RUN=['runId','jobId','headSha','event','conclusion'];
const RECEIPT=[
  'clubMappingSha256','codeSha','databaseDigestVerified','fittedModelSha256',
  'footbolnoRequired','githubRunId','holdoutEvaluationPermitted','holdoutRead',
  'immutableStudyLockApproved','insertedByThisRun','kind','modelApproved',
  'modelArtifactSha256','privateModelStored','productionForecastsWritten',
  'protocol','researchState','schemaVersion','sourceBytesSha256','sourceCommit',
  'sourceGitBlobSha1','storedRunId','trainRowsSha256','trainingClubs','trainingMatches'
];
const DATABASE=['region','relation','privateModelCount','modelBytes',
  'byteDigestVerified','anonSelectDenied','authenticatedSelectDenied',
  'serviceRoleSelectDenied','serviceRoleInsertDenied','forceRls',
  'appendOnlyMutationTriggers','allModelsTrainOnlyUnapproved'];
const GATE=['holdoutRead','modelApproved','immutableStudyLockApproved',
  'holdoutEvaluationPermitted','productionIngestionApproved','productionForecastsWritten'];
const INVALID=Object.freeze({state:'invalid',receipt:null,runId:null});
const closed=(value,fields)=>value!==null&&typeof value==='object'&&
  !Array.isArray(value)&&Object.keys(value).length===fields.length&&
  fields.every(key=>Object.hasOwn(value,key));
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);

/** Protected aggregate-only escrow evidence; never private model bytes or approval. */
export function inspectM2ProtectedPrivateEscrow(value,previousReplay){
  try{
    const replay=inspectM2OpenFootballReplay(previousReplay);
    if(replay.state!=='recorded'||!closed(value,ROOT)||
      value.schemaVersion!==1||
      value.kind!=='M2_OPENFOOTBALL_PROTECTED_PRIVATE_ESCROW_EVIDENCE'||
      value.researchClassification!=='TRAIN_ONLY_UNAPPROVED'||
      value.observedAtDate!=='2026-11-03'||
      !closed(value.run,RUN)||value.run.runId!==expected.runId||
      value.run.jobId!==expected.jobId||value.run.headSha!==expected.headSha||
      value.run.event!=='issue_comment'||value.run.conclusion!=='success'||
      value.receiptSha256!==expected.receiptSha256||
      !closed(value.receipt,RECEIPT)||
      !closed(value.databaseVerification,DATABASE)||!closed(value.gate,GATE))
      return INVALID;
    const r=value.receipt,b=value.databaseVerification,g=value.gate;
    if(r.schemaVersion!==1||
      r.kind!=='M2_OPENFOOTBALL_PRIVATE_TRAIN_ONLY_ESCROW'||
      r.protocol!=='m2-openfootball-calendar-v1'||
      r.researchState!=='TRAIN_ONLY_UNAPPROVED'||
      r.codeSha!==expected.headSha||r.githubRunId!==expected.runId||
      r.storedRunId!==expected.runId||
      r.sourceCommit!=='63df627f3c87ce71708f016522ea236cf74332c3'||
      r.sourceGitBlobSha1!=='6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc'||
      r.trainingMatches!==240||r.trainingClubs!==16||
      r.modelArtifactSha256!==expected.modelArtifactSha256||
      !['sourceBytesSha256','trainRowsSha256','clubMappingSha256',
        'fittedModelSha256','modelArtifactSha256'].every(k=>hex(r[k]))||
      !['sourceBytesSha256','trainRowsSha256','clubMappingSha256',
        'fittedModelSha256'].every(k=>
        r[k]===previousReplay.receipt[k])||
      r.databaseDigestVerified!==true||r.insertedByThisRun!==true||
      r.privateModelStored!==true||r.holdoutEvaluationPermitted!==false||
      r.holdoutRead!==false||r.modelApproved!==false||
      r.immutableStudyLockApproved!==false||r.footbolnoRequired!==false||
      r.productionForecastsWritten!==0)
      return INVALID;
    if(createHash('sha256').update(JSON.stringify(r)+'\n','utf8').digest('hex')!==
       expected.receiptSha256)return INVALID;
    if(b.region!=='eu-central-1'||
      b.relation!=='ff_private.ff_m2_training_model_escrow'||
      b.privateModelCount!==1||b.modelBytes!==1447||
      b.byteDigestVerified!==true||b.anonSelectDenied!==true||
      b.authenticatedSelectDenied!==true||b.serviceRoleSelectDenied!==true||
      b.serviceRoleInsertDenied!==true||b.forceRls!==true||
      b.appendOnlyMutationTriggers!==2||b.allModelsTrainOnlyUnapproved!==true)
      return INVALID;
    if(g.holdoutRead!==false||g.modelApproved!==false||
      g.immutableStudyLockApproved!==false||
      g.holdoutEvaluationPermitted!==false||
      g.productionIngestionApproved!==false||g.productionForecastsWritten!==0)
      return INVALID;
    return Object.freeze({
      state:'recorded',runId:expected.runId,codeSha:expected.headSha,
      artifactSha256:expected.modelArtifactSha256,
      fittedModelSha256:r.fittedModelSha256,
      receiptSha256:expected.receiptSha256,
      trainingMatches:240,trainingClubs:16,modelBytes:1447,
      privateModelStored:true,modelApproved:false,holdoutRead:false,
      immutableStudyLockApproved:false,productionIngestionApproved:false
    });
  }catch{
    return INVALID;
  }
}
