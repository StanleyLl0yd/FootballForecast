const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const closed=(x,fields)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===fields.length&&fields.every(k=>Object.hasOwn(x,k));
const exact=(x,expected)=>closed(x,Object.keys(expected))&&
  Object.entries(expected).every(([k,v])=>x[k]===v);
const FAIL=Object.freeze({state:'invalid',runId:null,openFootball:null,openFoot:null,sportScore:null});
const HEADER={"schemaVersion":1,"kind":"M2_PROTECTED_PUBLIC_SOURCE_OBSERVATION_EVIDENCE","classification":"SOURCE_OBSERVATION_ONLY_UNAPPROVED","observedAtDate":"2026-11-03"};
const RUN={"runId":41613346756,"headSha":"5d99fa3bbda4b79384c54f847ab5e610da42e7df","event":"issue_comment","conclusion":"success"};
const JOBS=[{"name":"bounded-openfoot-rpl-demo","id":125840531829,"conclusion":"success"},{"name":"pinned-openfootball","id":125840532161,"conclusion":"success"},{"name":"bounded-sportscore-current","id":125840532282,"conclusion":"success"}];
const OPEN_FOOTBALL={"season":"2024/2025","fixtures":240,"clubs":16,"rounds":30,"awarded":0,"verifiedKickoffInstants":0,"gitCommit":"63df627f3c87ce71708f016522ea236cf74332c3","gitBlobSha1":"6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc","sourceBytesSha256":"f315f67d49e5f2ed26bb5b2504244f36d37be958b5ccadd1755fb6b71b015dcb","exactSourceVersionVerified":true,"independentUpstreamVerified":false,"trainingReplayApproved":false};
const OPEN_FOOT={"season":"2026/27","competition":"comp_premier_league_rus","observedAtUtc":"2026-11-03T09:43:40Z","matchesObserved":5,"distinctClubsObserved":10,"finishedObserved":5,"scheduledObserved":0,"withUtcKickoff":5,"coverageState":"PARTIAL_UNAPPROVED","sourceResponseSha256":"e04de45affbc43aa00528780a9f47d284924198f09f0964c6314ac6e9ccbd9a1","completeSeasonVerified":false,"redistributionRightsVerified":false};
const SPORT_SCORE={"observedAtUtc":"2026-11-03T09:43:55Z","dateUtc":"2026-11-03","providerRowsReturned":0,"recognisedRplMatches":0,"coverageState":"NO_VERIFIED_CURRENT_DAY_RPL_OBSERVATIONS","responseSha256":"672483e2478d1a0ff41c4c76169066c7848c1a809bc13fa1fc33cbe66bdf9a3e","completeSeasonVerified":false,"completeDayVerified":false};
const GATE={"holdoutRead":false,"modelApproved":false,"liveSourceApproved":false,"productionWrites":0,"publishedForecasts":0};

/** A bounded owner-only historical observation, never approved coverage or model. */
export function inspectM2PublicSourceObservations(value){
  try{
    if(!closed(value,['schemaVersion','kind','classification','observedAtDate',
                       'run','observations','gate'])||
       !Object.entries(HEADER).every(([key,val])=>value[key]===val)||
       !closed(value.run,['runId','headSha','event','conclusion','jobs'])||
       !Object.entries(RUN).every(([key,val])=>value.run[key]===val)||
       !SHA40.test(value.run.headSha)||
       !Array.isArray(value.run.jobs)||value.run.jobs.length!==3||
       value.run.jobs.some((item,i)=>!exact(item,JOBS[i]))||
       !closed(value.observations,['openFootball','openFoot','sportScore'])||
       !exact(value.observations.openFootball,OPEN_FOOTBALL)||
       !exact(value.observations.openFoot,OPEN_FOOT)||
       !exact(value.observations.sportScore,SPORT_SCORE)||
       !exact(value.gate,GATE)||
       ![value.observations.openFootball.sourceBytesSha256,
         value.observations.openFoot.sourceResponseSha256,
         value.observations.sportScore.responseSha256].every(s=>typeof s==='string'&&SHA64.test(s)))
       return FAIL;
    return Object.freeze({
      state:'recorded',runId:RUN.runId,
      openFootball:Object.freeze({matches:240,clubs:16,
        sourceSha256:OPEN_FOOTBALL.sourceBytesSha256,unverifiedKickoffs:true}),
      openFoot:Object.freeze({matches:5,clubs:10,finished:5,
        coverage:'PARTIAL_UNAPPROVED',
        responseSha256:OPEN_FOOT.sourceResponseSha256}),
      sportScore:Object.freeze({matches:0,dateUtc:'2026-11-03',
        coverage:'NO_VERIFIED_CURRENT_DAY_RPL_OBSERVATIONS',
        responseSha256:SPORT_SCORE.responseSha256})
    });
  }catch{return FAIL;}
}
