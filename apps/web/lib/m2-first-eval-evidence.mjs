import {createHash} from 'node:crypto';

const EXPECTED_RUN=42590191735;
const EXPECTED_JOB=129069659805;
const EXPECTED_HEAD='2e2bb2394b00d1c6a3fb8dc735f3fecddcaa9126';
const EXPECTED_SOURCE='433389a0e6cab9d84c519fdf5195994b86cc92687acefe10920b1d06eaacaf7b';
const EXPECTED_COHORT='2c7c564533f1c56a8c35ff0c6b819f940f0b68c57d7be92e179341bcf598c5dc';
const EXPECTED_NAMES='d6987da7a0362ee9917a002c0e88c5e99b5846377ea3cea2cb1819329484868e';
const EXPECTED_AGGREGATE='dacc42c91074d9a57bcc1ea0ee070e4a32696062977a62ba04b6a419922541b0';
const EXPECTED_DECL='5adcdf55890a5ebf75019b8bf48ec2f274267b50ca0aee1454682f69c26a7591';
const EXPECTED_RECEIPT='5aa9772173206e93a60577adc4d02f4e0e04b47154e92f4103b82d4c11586f2e';
const STUDY_ID='rpl-2025-26-football-data-fixed-poisson-v1';

const ROOT=['schemaVersion','kind','observedAtDate','researchClassification','run',
  'receiptSha256','receipt','databaseVerification','constraints'];
const RUN=['runId','jobId','headSha','event','actor','conclusion'];
const RECEIPT=['abstentions','codeSha','declarationSha256','eligibleMatches',
  'githubRunId','kind','oneUseReservationConsumed','predeclaredNamesSha256',
  'privateAggregateSha256','productionForecastsWritten','rawLabelsPublished',
  'schemaVersion','scoreMetricsPrivate','selectedRowsSha256','sourceSha256',
  'strictAsOfBacktestClaimed','studyId'];
const DB=['relation','studyClaims','storedResults','trainOnlyModels','source',
  'sourceSha256','selectedRowsSha256','eligible','abstentions','totalFixtures',
  'kickoffTimeQuality','oneTimeClaimCommittedBeforeFetch','modelTuning',
  'privateMetricsStored','rawSourceRowsPublished','publishedForecastCount'];
const LIMITS=['fullSourceBytesArchived','bitwiseIndependentReplayPossible',
  'metricsIncludedInPublicRepository','preMatchAsOfVerified',
  'bookmakerSuperiorityProven','productionModelApproved','oneUseRerunPermitted',
  'm3Authorized'];
const INVALID=Object.freeze({state:'invalid',runId:null,counts:null});
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const closed=(value,keys)=>isObject(value)&&Object.keys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key));

/**
 * Verify a signed-by-process GitHub Actions receipt and one-shot aggregate-only
 * PostgreSQL evidence. The public repository NEVER contains the actual metrics,
 * model weights, private team/source IDs or result-bearing match records.
 * This is an immutable historical observation, not permission to rerun the
 * holdout or a claim that raw source bytes were archived for future replay.
 *
 * @param {unknown} payload
 */
export function inspectM2FirstPrivateEvaluation(payload){
  try{
    if(!closed(payload,ROOT)||!closed(payload.run,RUN)||
       !closed(payload.receipt,RECEIPT)||
       !closed(payload.databaseVerification,DB)||
       !closed(payload.constraints,LIMITS))return INVALID;
    const d=payload,run=d.run,r=d.receipt,db=d.databaseVerification,c=d.constraints;
    if(d.schemaVersion!==1||
       d.kind!=='M2_FIRST_PRIVATE_FIXED_2025_26_EVALUATION_EVIDENCE'||
       d.observedAtDate!=='2026-11-09'||
       d.researchClassification!=='NON_STRICT_RETROSPECTIVE'||
       run.runId!==EXPECTED_RUN||run.jobId!==EXPECTED_JOB||
       run.headSha!==EXPECTED_HEAD||run.event!=='issue_comment'||
       run.actor!=='StanleyLl0yd'||run.conclusion!=='success'||
       d.receiptSha256!==EXPECTED_RECEIPT)return INVALID;

    const canonical=JSON.stringify(Object.fromEntries(
      [...RECEIPT].sort().map(key=>[key,r[key]])
    ))+'\n';
    const computed=createHash('sha256').update(canonical).digest('hex');
    if(computed!==EXPECTED_RECEIPT||
       r.schemaVersion!==1||
       r.kind!=='M2_FIRST_PRIVATE_FIXED_SCORE_STORED'||
       r.studyId!==STUDY_ID||r.codeSha!==EXPECTED_HEAD||
       r.githubRunId!==EXPECTED_RUN||
       r.declarationSha256!==EXPECTED_DECL||
       r.sourceSha256!==EXPECTED_SOURCE||
       r.selectedRowsSha256!==EXPECTED_COHORT||
       r.predeclaredNamesSha256!==EXPECTED_NAMES||
       r.privateAggregateSha256!==EXPECTED_AGGREGATE||
       r.eligibleMatches!==182||r.abstentions!==58||
       r.oneUseReservationConsumed!==true||r.scoreMetricsPrivate!==true||
       r.rawLabelsPublished!==false||r.strictAsOfBacktestClaimed!==false||
       r.productionForecastsWritten!==0)return INVALID;
    if(db.relation!=='ff_private.ff_m2_one_use_study_results'||
       db.studyClaims!==1||db.storedResults!==1||db.trainOnlyModels!==1||
       db.source!=='https://www.football-data.co.uk/new/RUS.csv'||
       db.sourceSha256!==EXPECTED_SOURCE||db.selectedRowsSha256!==EXPECTED_COHORT||
       db.eligible!==182||db.abstentions!==58||db.totalFixtures!==240||
       db.kickoffTimeQuality!=='DAY_ONLY'||
       db.oneTimeClaimCommittedBeforeFetch!==true||
       db.modelTuning!==false||db.privateMetricsStored!==true||
       db.rawSourceRowsPublished!==false||db.publishedForecastCount!==0||
       LIMITS.some(key=>c[key]!==false))return INVALID;
    return {
      state:'recorded',runId:EXPECTED_RUN,
      counts:Object.freeze({total:240,eligible:182,abstentions:58}),
      studyId:STUDY_ID,sourceSha256:EXPECTED_SOURCE,
      cohortSha256:EXPECTED_COHORT,
      receiptSha256:EXPECTED_RECEIPT,
      declarationSha256:EXPECTED_DECL,
      privateAggregateSha256:EXPECTED_AGGREGATE,
      interpretation:'DAY_ONLY_NON_STRICT_RETROSPECTIVE',
      irreversible:true,privateMetrics:true,bitwiseReplayPossible:false
    };
  }catch{return INVALID;}
}
