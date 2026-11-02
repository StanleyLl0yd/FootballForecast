// Untrusted aggregate-only attestation viewer. Never accepts football rows.
const fields=[
  'schemaVersion','kind','protocol','codeSha','sourceSha256',
  'snapshotIdentitySha256','trainRowsSha256','clubMappingSha256',
  'fittedModelSha256','trainOutcomeCountsHDA','trainingMatches','trainingClubs',
  'researchClassification','holdoutRead','historicalPrematchVerified',
  'modelAccuracyEvaluated'
];
const digest=/^[a-f0-9]{64}$/;
const commit=/^[a-f0-9]{40}$/;
const fail=()=>{throw new Error('Файл не соответствует закрытой схеме M2: нужны только проверяемые агрегаты и SHA-256.');};

/**
 * Validate a future, untrusted local research candidate without authority claims.
 * @param {unknown} payload
 */
export function inspectM2PreHoldoutLock(payload){
  if(payload===null||typeof payload!=='object'||Array.isArray(payload))return fail();
  /** @type {Record<string, unknown>} */
  const data=payload;
  const keys=Object.keys(data);
  if(keys.length!==fields.length||keys.some(key=>!fields.includes(key)))return fail();
  const counts=data.trainOutcomeCountsHDA;
  if(data.schemaVersion!==1||data.kind!=='M2_PRE_HOLDOUT_LOCK'||
     data.protocol!=='m2-independent-poisson-v1'||
     data.researchClassification!=='NON_STRICT_RETROSPECTIVE'||
     data.holdoutRead!==false||data.historicalPrematchVerified!==false||
     data.modelAccuracyEvaluated!==false||
     data.trainingMatches!==240||data.trainingClubs!==16||
     typeof data.codeSha!=='string'||!commit.test(data.codeSha)||
     !['sourceSha256','snapshotIdentitySha256','trainRowsSha256','clubMappingSha256','fittedModelSha256']
       .every(key=>typeof data[key]==='string'&&digest.test(data[key]))||
     !Array.isArray(counts)||counts.length!==3||
     !counts.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=240)||
     counts.reduce((sum,n)=>sum+n,0)!==240)return fail();
  return {
    codeSha:data.codeSha,
    sourceSha256:data.sourceSha256,
    modelSha256:data.fittedModelSha256,
    trainRowsSha256:data.trainRowsSha256,
    clubMappingSha256:data.clubMappingSha256,
    snapshotIdentitySha256:data.snapshotIdentitySha256,
    trainingMatches:240,trainingClubs:16,
    homeWins:counts[0],draws:counts[1],awayWins:counts[2]
  };
}
