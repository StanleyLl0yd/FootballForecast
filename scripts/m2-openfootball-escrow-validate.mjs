// Verify protected, aggregate-only model escrow evidence; never decode private model bytes.
import {constants,openSync,closeSync,fstatSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const fail=()=>{throw Error('M2 private escrow receipt is unverified');};
const SHA64=/^[a-f0-9]{64}$/,SHA40=/^[a-f0-9]{40}$/;
const fields=[
  'schemaVersion','kind','protocol','sourceCommit','sourceGitBlobSha1',
  'sourceBytesSha256','codeSha','trainRowsSha256','clubMappingSha256',
  'fittedModelSha256','modelArtifactSha256','trainingMatches','trainingClubs',
  'githubRunId','researchState','holdoutRead','modelApproved',
  'productionForecastsWritten','footbolnoRequired','storedRunId',
  'insertedByThisRun','privateModelStored','databaseDigestVerified',
  'immutableStudyLockApproved','holdoutEvaluationPermitted'
];
export function inspectPrivateOpenFootballEscrow(value,referenceReceipt,{codeSha,runId}){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     referenceReceipt===null||typeof referenceReceipt!=='object'||
     Array.isArray(referenceReceipt)||!SHA40.test(codeSha)||
     !Number.isSafeInteger(runId)||runId<=0)fail();
  const keys=Object.keys(value);
  if(keys.length!==fields.length||!fields.every(k=>Object.hasOwn(value,k)))fail();
  if(value.schemaVersion!==1||
     value.kind!=='M2_OPENFOOTBALL_PRIVATE_TRAIN_ONLY_ESCROW'||
     value.protocol!=='m2-openfootball-calendar-v1'||
     value.sourceCommit!=='63df627f3c87ce71708f016522ea236cf74332c3'||
     value.sourceGitBlobSha1!=='6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc'||
     value.codeSha!==codeSha||value.githubRunId!==runId||
     value.trainingMatches!==240||value.trainingClubs!==16||
     value.researchState!=='TRAIN_ONLY_UNAPPROVED'||
     value.holdoutRead!==false||value.modelApproved!==false||
     value.productionForecastsWritten!==0||value.footbolnoRequired!==false||
     value.privateModelStored!==true||value.databaseDigestVerified!==true||
     value.immutableStudyLockApproved!==false||
     value.holdoutEvaluationPermitted!==false||
     typeof value.insertedByThisRun!=='boolean'||
     !Number.isSafeInteger(value.storedRunId)||value.storedRunId<=0)fail();
  if(referenceReceipt.kind!=='M2_OPENFOOTBALL_EPHEMERAL_TRAIN_CANDIDATE')fail();
  for(const field of [
    'sourceBytesSha256','trainRowsSha256','clubMappingSha256','fittedModelSha256'
  ]){
    if(!SHA64.test(value[field])||value[field]!==referenceReceipt[field])fail();
  }
  if(!SHA64.test(value.modelArtifactSha256))fail();
  return Object.freeze({
    privateModelStored:true,sha256:value.modelArtifactSha256,
    fittedModelSha256:value.fittedModelSha256,
    codeSha:value.codeSha,githubRunId:value.githubRunId,
    storedRunId:value.storedRunId,
    researchState:'TRAIN_ONLY_UNAPPROVED',
    holdoutRead:false,modelApproved:false,
  });
}

function load(file,max=4096){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>max)fail();
    return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(readFileSync(fd)));
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)fail();
    const provenance=load('docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json',10000);
    if(provenance.kind!=='M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE'||
       provenance.researchClassification!=='TRAIN_ONLY_UNAPPROVED')fail();
    inspectPrivateOpenFootballEscrow(load(process.argv[2]),provenance.receipt,{
      codeSha:process.env.GITHUB_SHA,runId:Number(process.env.GITHUB_RUN_ID),
    });
  }catch{
    console.error('FAIL: protected private escrow receipt mismatch; no model data logged');
    process.exitCode=2;
  }
}
