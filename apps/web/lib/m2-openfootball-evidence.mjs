import {createHash} from 'node:crypto';

const ROOT=['schemaVersion','kind','researchClassification','observedAtDate','receiptSha256','receipt','runs'];
const RECEIPT=['clubMappingSha256','codeSha','fittedModelSha256','footbolnoRequired',
  'historicalPrematchVerified','holdoutRead','kickoffInstantsVerified','kind',
  'modelApproved','privateModelPersisted','productionForecastsWritten','protocol',
  'researchClassification','schemaVersion','source','sourceBytesSha256',
  'sourceCommit','sourceGitBlobSha1','sourceLicense','trainOutcomeCountsHDA',
  'trainRowsSha256','trainingClubs','trainingMatches'];
const RUN=['runId','jobId','headSha','event','conclusion'];
const SOURCE_SHA='f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb';
const EXEC_SHA='b7812c531a7284a4db58c34ed77af8adeecf8d1f';
const RECEIPT_SHA='381159c8928283c6f3d9a2b75bda4ee53d1b9a41f31184d5cd9a14ec267306b6';
const KNOWN_RUNS=[[41601074078,125799666983],[41601164752,125799964125]];
const hex64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const closed=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k));

/** Recorded, independently checked GitHub run metadata, never approval or escrow. */
export function inspectM2OpenFootballReplay(value){
  const invalid=Object.freeze({state:'invalid',receipt:null,runs:[]});
  try{
    if(!closed(value,ROOT)||value.schemaVersion!==1||
       value.kind!=='M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE'||
       value.researchClassification!=='TRAIN_ONLY_UNAPPROVED'||
       value.observedAtDate!=='2026-11-03'||value.receiptSha256!==RECEIPT_SHA||
       !closed(value.receipt,RECEIPT))return invalid;
    const r=value.receipt;
    if(r.schemaVersion!==1||r.kind!=='M2_OPENFOOTBALL_EPHEMERAL_TRAIN_CANDIDATE'||
       r.protocol!=='m2-openfootball-calendar-v1'||
       r.researchClassification!=='TRAIN_ONLY_UNAPPROVED'||
       r.source!=='OpenFootball'||r.sourceLicense!=='CC0-1.0'||
       r.sourceCommit!=='63df627f3c87ce71708f016522ea236cf74332c3'||
       r.sourceGitBlobSha1!=='6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc'||
       r.sourceBytesSha256!==SOURCE_SHA||r.codeSha!==EXEC_SHA||
       !['clubMappingSha256','fittedModelSha256','trainRowsSha256'].every(k=>hex64(r[k]))||
       r.trainingMatches!==240||r.trainingClubs!==16||r.kickoffInstantsVerified!==0||
       r.footbolnoRequired!==false||r.holdoutRead!==false||
       r.historicalPrematchVerified!==false||r.modelApproved!==false||
       r.privateModelPersisted!==false||r.productionForecastsWritten!==0||
       !Array.isArray(r.trainOutcomeCountsHDA)||r.trainOutcomeCountsHDA.length!==3||
       r.trainOutcomeCountsHDA.some(x=>!Number.isSafeInteger(x)||x<0||x>240)||
       r.trainOutcomeCountsHDA.reduce((a,b)=>a+b,0)!==240)return invalid;
    const serialized=JSON.stringify(r)+'\n';
    if(createHash('sha256').update(serialized,'utf8').digest('hex')!==RECEIPT_SHA)
      return invalid;
    if(!Array.isArray(value.runs)||value.runs.length!==2)return invalid;
    for(let i=0;i<2;i++){
      const run=value.runs[i],ids=KNOWN_RUNS[i];
      if(!closed(run,RUN)||run.runId!==ids[0]||run.jobId!==ids[1]||
         run.headSha!==EXEC_SHA||run.event!=='issue_comment'||
         run.conclusion!=='success')return invalid;
    }
    return {
      state:'recorded',
      receipt:{
        protocol:r.protocol,sourceSha256:r.sourceBytesSha256,codeSha:r.codeSha,
        trainRowsSha256:r.trainRowsSha256,fittedModelSha256:r.fittedModelSha256,
        clubMappingSha256:r.clubMappingSha256,receiptSha256:RECEIPT_SHA,
        trainingMatches:r.trainingMatches,trainingClubs:r.trainingClubs,
        homeWins:r.trainOutcomeCountsHDA[0],draws:r.trainOutcomeCountsHDA[1],
        awayWins:r.trainOutcomeCountsHDA[2]
      },
      runs:value.runs.map(x=>x.runId),
    };
  }catch{return invalid;}
}
