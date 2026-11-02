import {createHash} from 'node:crypto';
import {inspectM2StoredCandidate} from './m2-candidate-replay.mjs';

const rootFields=[
  'schemaVersion','kind','researchClassification','observedAtDate',
  'receiptSha256','receipt','runs'
];
const runFields=['runId','jobId','headSha','event','conclusion'];
const digest=/^[a-f0-9]{64}$/;

/**
 * Read-only, allowlisted interpretation of committed train-only observations.
 * Never authorizes a model lock, publication or reading sealed labels.
 * @param {unknown} payload
 */
export function summarizeM2OwnerEvidence(payload){
  const invalid={state:'invalid',receipt:null,runs:[]};
  try{
    if(!payload||typeof payload!=='object'||Array.isArray(payload))return invalid;
    const data=/** @type {Record<string,unknown>} */(payload);
    if(Object.keys(data).length!==rootFields.length||
       !rootFields.every(key=>Object.hasOwn(data,key))||
       data.schemaVersion!==1||
       data.kind!=='M2_STORED_TRAIN_REPLAY_EVIDENCE'||
       data.researchClassification!=='TRAIN_ONLY_UNAPPROVED'||
       data.observedAtDate!=='2026-11-02'||
       typeof data.receiptSha256!=='string'||!digest.test(data.receiptSha256))
      return invalid;
    const receiptData=data.receipt;
    const fingerprints=inspectM2StoredCandidate(receiptData);
    const computed=createHash('sha256').update(JSON.stringify(receiptData)+'\n').digest('hex');
    if(computed!==data.receiptSha256||
       fingerprints.sourceSha256!=='038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f')
      return invalid;
    if(!Array.isArray(data.runs)||data.runs.length!==2)return invalid;
    const runIds=new Set(),jobIds=new Set();
    for(const item of data.runs){
      if(!item||typeof item!=='object'||Array.isArray(item))return invalid;
      const run=/** @type {Record<string,unknown>} */(item);
      if(Object.keys(run).length!==runFields.length||
         !runFields.every(key=>Object.hasOwn(run,key))||
         !Number.isSafeInteger(run.runId)||run.runId<=0||
         !Number.isSafeInteger(run.jobId)||run.jobId<=0||
         run.headSha!==fingerprints.codeSha||
         run.event!=='issue_comment'||run.conclusion!=='success'||
         runIds.has(run.runId)||jobIds.has(run.jobId))return invalid;
      runIds.add(run.runId);jobIds.add(run.jobId);
    }
    return {
      state:'recorded',
      receipt:{
        codeSha:fingerprints.codeSha,
        sourceSha256:fingerprints.sourceSha256,
        fittedModelSha256:fingerprints.fittedModelSha256,
        trainRowsSha256:fingerprints.trainRowsSha256,
        receiptSha256:data.receiptSha256
      },
      runs:[...runIds]
    };
  }catch{return invalid;}
}
