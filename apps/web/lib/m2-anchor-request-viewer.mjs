// Parse a locally supplied, untrusted pending anchor request. Never approve a study.
const fields=[
  'schemaVersion','kind','reviewState','holdoutAccessAuthorized','holdoutRead',
  'researchClassification','repository','protectedRef','protocol','codeSha',
  'sourceSha256','openFootballReferenceBlob','snapshotIdentitySha256',
  'trainRowsSha256','clubMappingSha256','fittedModelSha256',
  'trainingAttestationCanonicalSha256','sourceComparisonCanonicalSha256',
  'workflowRunId','workflowJobId','workflowHeadSha','runnerImageSha256',
  'dependencyManifestSha256','privateModelArtifactSha256'
];
const fingerprints=[
  'sourceSha256','snapshotIdentitySha256','trainRowsSha256',
  'clubMappingSha256','fittedModelSha256','trainingAttestationCanonicalSha256',
  'sourceComparisonCanonicalSha256','runnerImageSha256',
  'dependencyManifestSha256','privateModelArtifactSha256'
];
const sha40=/^[a-f0-9]{40}$/;
const sha64=/^[a-f0-9]{64}$/;
const reject=()=>{throw Error('Недопустимый запрос на фиксацию M2: ожидается закрытая схема из 24 полей без приватных данных.');};

/** Only checks a pending request's syntax and internal consistency, not origin or authority.
 * @param {unknown} payload
 */
export function inspectM2PendingAnchorRequest(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return reject();
  const data=/** @type {Record<string,unknown>} */(payload);
  if(Object.keys(data).length!==fields.length||
     !fields.every(field=>Object.hasOwn(data,field))||
     data.schemaVersion!==1||data.kind!=='M2_STUDY_ANCHOR_REQUEST'||
     data.reviewState!=='PENDING_INDEPENDENT_REVIEW'||
     data.holdoutAccessAuthorized!==false||data.holdoutRead!==false||
     data.researchClassification!=='NON_STRICT_RETROSPECTIVE'||
     data.repository!=='StanleyLl0yd/FootballForecast'||
     data.protectedRef!=='refs/heads/main'||
     data.protocol!=='m2-independent-poisson-v1'||
     data.openFootballReferenceBlob!=='6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc'||
     typeof data.codeSha!=='string'||!sha40.test(data.codeSha)||
     data.workflowHeadSha!==data.codeSha||
     !fingerprints.every(field=>typeof data[field]==='string'&&sha64.test(data[field]))||
     !['workflowRunId','workflowJobId'].every(field=>
       typeof data[field]==='number'&&Number.isSafeInteger(data[field])&&data[field]>0))
    return reject();
  return {
    state:'pending',
    codeSha:data.codeSha,
    sourceSha256:data.sourceSha256,
    fittedModelSha256:data.fittedModelSha256,
    trainingAttestationCanonicalSha256:data.trainingAttestationCanonicalSha256,
    sourceComparisonCanonicalSha256:data.sourceComparisonCanonicalSha256,
    runnerImageSha256:data.runnerImageSha256,
    dependencyManifestSha256:data.dependencyManifestSha256,
    privateModelArtifactSha256:data.privateModelArtifactSha256,
    workflowRunId:data.workflowRunId,
    workflowJobId:data.workflowJobId
  };
}
