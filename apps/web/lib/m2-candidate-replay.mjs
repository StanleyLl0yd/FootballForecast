// Strictly allowlisted, locally supplied aggregate train-only receipts.
const fields=[
  'schemaVersion','kind','codeSha','sourceSha256','snapshotIdentitySha256',
  'trainRowsSha256','clubMappingSha256','fittedModelSha256','trainingMatches',
  'trainingClubs','storedTrainOnly','externalSourceRechecked','modelFitted',
  'preHoldoutLockApproved','holdoutRead','historicalPrematchVerified',
  'modelAccuracyEvaluated'
];
const identities=[
  'codeSha','sourceSha256','snapshotIdentitySha256',
  'trainRowsSha256','clubMappingSha256','fittedModelSha256'
];
const sha40=/^[a-f0-9]{40}$/;
const sha64=/^[a-f0-9]{64}$/;
const invalid=()=>{throw new Error('Недопустимый train-only отчёт: нужны только 17 полей закрытой схемы M2.');};

/** @param {unknown} payload */
export function inspectM2StoredCandidate(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return invalid();
  /** @type {Record<string, unknown>} */
  const data=payload;
  const keys=Object.keys(data);
  if(keys.length!==fields.length||!fields.every(field=>Object.hasOwn(data,field)))return invalid();
  if(data.schemaVersion!==1||data.kind!=='M2_STORED_TRAIN_CANDIDATE'||
     data.trainingMatches!==240||data.trainingClubs!==16||
     data.storedTrainOnly!==true||data.externalSourceRechecked!==false||
     data.modelFitted!==true||data.preHoldoutLockApproved!==false||
     data.holdoutRead!==false||data.historicalPrematchVerified!==false||
     data.modelAccuracyEvaluated!==false||
     typeof data.codeSha!=='string'||!sha40.test(data.codeSha)||
     !identities.slice(1).every(key=>typeof data[key]==='string'&&sha64.test(data[key])))
    return invalid();
  return Object.fromEntries(identities.map(key=>[key,String(data[key])]));
}

/**
 * Compare two untrusted receipts only; this is not source verification or model approval.
 * @param {unknown} first
 * @param {unknown} second
 */
export function compareM2StoredCandidates(first,second){
  const left=inspectM2StoredCandidate(first);
  const right=inspectM2StoredCandidate(second);
  const mismatches=identities.filter(key=>left[key]!==right[key]);
  return {
    equal:mismatches.length===0,
    mismatches,
    common:mismatches.length===0?left:null
  };
}
