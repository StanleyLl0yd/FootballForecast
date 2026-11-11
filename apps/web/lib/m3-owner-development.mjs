/** Validated aggregate-only retrospective research view-model for the owner.
 * Pure no-I/O function. Historical M2/early M3 diagnostics are not current gates.
 */
const YEARS=['2018/19','2019/20','2020/21','2021/22',
  '2022/23','2023/24','2024/25'];
const VALIDATION=YEARS.slice(2);
const EXCLUDED=[0,4,2,0,1,0,0];
const TRAIN=[476,714,954,1193,1433];
const SCORED=[238,240,239,240,240];
const RUN_HASH='c9ef3e4bb37f70a451aa6c4bcb41dbe8d1a5c941543705b8c700d8e2514c2c98';
const CORRELATION_HASH='e3032565aa0332b03b39b1860f33179dbd003dd19224474a2418bd497e1d331d';
const SHA=/^[0-9a-f]{64}$/;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=Object.freeze({state:'blocked',acceptedTechnicalGates:0,
  seasons:[],folds:[],totalCorrespondences:0,playedCandidates:0,excluded:0,
  model:null,links:null,strictAsOf:false,productionApproved:false});
const equal=(x,y)=>Math.abs(Number(x)-Number(y))<0.000002;
const finite=x=>typeof x==='string'&&/^\d+\.\d{6}$/.test(x)&&
  Number.isFinite(Number(x));
const clean=(value)=>JSON.parse(JSON.stringify(value));

/** @param {unknown} a3  @param {unknown} dev */
export function inspectM3OwnerDevelopment(a3,dev){
  try{
    if(!record(a3)||!record(dev)||!record(a3.totals)||!record(a3.scope)||
      !record(a3.gates)||!record(dev.protectedReceipt)||!record(dev.limitations)||
      !record(dev.candidate)||!record(dev.comparator)||!record(dev.gates)||
      !Array.isArray(a3.perSeason)||!Array.isArray(a3.exclusions)||
      !Array.isArray(a3.references)||!Array.isArray(dev.folds))return fail;
    if(a3.schemaVersion!==1||
       a3.kind!=='M3_A3_SEVEN_SEASON_NON_STRICT_RETROSPECTIVE_DEVELOPMENT_COHORT'||
       a3.status!=='PROPOSED_A3_TECHNICAL_ACCEPTANCE_NOT_STRICT_AS_OF'||
       dev.schemaVersion!==1||
       dev.kind!=='M3_A4_A5_A6_REAL_DEVELOPMENT_NON_STRICT_RETROSPECTIVE'||
       dev.status!=='PROPOSED_A4_A5_A6_TECHNICAL_ACCEPTANCE_PENDING_A3_COMMIT'||
       a3.perSeason.length!==7||dev.folds.length!==5||a3.exclusions.length!==7||
       a3.references.length!==4)return fail;
    if(a3.totals.publicFixtures!==1680||
       a3.totals.privateProviderFinishedFixtures!==1680||
       a3.totals.scoreFreeGraphMatches!==1680||
       a3.totals.unmatchedPublicFixtures!==0||
       a3.totals.unmatchedPrivateFixtures!==0||
       a3.totals.officialResultDisagreements!==0||
       a3.totals.knownTechnicalAwardsExcluded!==6||
       a3.totals.knownRevisedOfficialScoresExcluded!==1||
       a3.totals.excludedFromPlayedGoalLabels!==7||
       a3.totals.retrospectivePlayedScoreCandidates!==1673)return fail;
    if(a3.references[0]?.matched!==1200||
       a3.references[1]?.publicFixtures!==480||
       a3.references[2]?.matched!==480||
       a3.references[2]?.playedScoreCandidates!==479||
       a3.references[2]?.stableSharedClubIds!==13||
       a3.references[2]?.officialScoreDisagreements!==0||
       a3.references[2]?.aggregateSha256!==CORRELATION_HASH||
       dev.protectedReceipt.aggregateResultsSha256!==RUN_HASH||
       dev.protectedReceipt.validatedFolds!==5||
       dev.protectedReceipt.candidateScoredMatches!==1197||
       dev.protectedReceipt.withheldValidationCandidates!==3||
       !SHA.test(a3.references[2].aggregateSha256))return fail;
    const expectedKinds=['UNPLAYED_TECHNICAL_AWARD','OFFICIAL_SCORE_REVISED_AFTER_PLAY'];
    if(a3.exclusions.filter(x=>x.reason===expectedKinds[0]).length!==6||
       a3.exclusions.filter(x=>x.reason===expectedKinds[1]).length!==1||
       new Set(a3.exclusions.map(x=>[x.season,x.dateUtc,x.officialScore].join('/'))).size!==7)
      return fail;
    const revised=a3.exclusions.find(x=>x.reason===expectedKinds[1]);
    if(revised.season!=='2022/23'||revised.dateUtc!=='2023-03-19'||
       revised.officialScore!=='0:3'||revised.playedScore!=='1:1')return fail;
    const seasons=a3.perSeason.map((x,i)=>{
      if(!record(x)||x.season!==YEARS[i]||
         x.publicFixtures!==240||x.privateProviderFinishedFixtures!==240||
         x.scoreFreeGraphMatches!==240||x.officialResultDisagreements!==0||
         x.knownAdministrativeOrRevisedExcluded!==EXCLUDED[i]||
         x.retrospectivePlayedScoreCandidates!==240-EXCLUDED[i])
        throw Error('season');
      return Object.freeze({season:x.season,linked:240,
        playedCandidates:x.retrospectivePlayedScoreCandidates,excluded:EXCLUDED[i]});
    });
    if(!record(dev.candidate)||
       dev.candidate.name!=='FROZEN_SHRUNK_HOME_AWAY_TEAM_POISSON'||
       dev.candidate.leaguePseudoMatches!==20||dev.candidate.teamPseudoMatches!==12||
       dev.comparator.name!=='DIRICHLET_1_1_1_EMPIRICAL_HOME_DRAW_AWAY'||
       dev.comparator.scoredOnIdenticalFixtures!==true||
       dev.comparator.bookmakerComparator!=='UNAVAILABLE_NO_AUTHENTIC_SAME_CUTOFF_QUOTES')
      return fail;
    const folds=dev.folds.map((x,i)=>{
      if(!record(x)||x.validationSeason!==VALIDATION[i]||
         x.trainN!==TRAIN[i]||x.scoredN!==SCORED[i]||
         x.abstainedN!==240-SCORED[i]||
         !Number.isInteger(x.unseenTeamCandidates)||x.unseenTeamCandidates<0||
         x.unseenTeamCandidates>x.scoredN||
         !['baselineLogLoss','poissonLogLoss','pairedGainLogLoss',
           'pairedApprox95pctHalfwidth','baselineBrier','poissonBrier',
           'baselineRps','poissonRps'].every(key=>finite(x[key]))||
         !equal(Number(x.baselineLogLoss)-Number(x.poissonLogLoss),
           Number(x.pairedGainLogLoss))||
         !['LogLoss','Brier','Rps'].every(metric=>
           Number(x['baseline'+metric])>Number(x['poisson'+metric])))
        throw Error('fold');
      return Object.freeze({season:x.validationSeason,trainN:x.trainN,
        scoredN:x.scoredN,abstainedN:x.abstainedN,
        unseenN:x.unseenTeamCandidates,baseline:Object.freeze({
          logLoss:Number(x.baselineLogLoss),brier:Number(x.baselineBrier),
          rps:Number(x.baselineRps)}),
        poisson:Object.freeze({
          logLoss:Number(x.poissonLogLoss),brier:Number(x.poissonBrier),
          rps:Number(x.poissonRps)}),
        gain:Number(x.pairedGainLogLoss),
        approx95HalfWidth:Number(x.pairedApprox95pctHalfwidth)});
    });
    if(a3.scope.holdout2025_26Read!==false||
       a3.scope.privateRowsExported!==false||
       a3.scope.privateIdsExported!==false||
       a3.scope.historicalStrictAsOfClaim!==false||
       a3.scope.sourceTablesMutated!==false||
       a3.scope.publicForecastsPublished!==false||
       a3.gates.fullM3Accepted!==false||
       dev.limitations.consumedHoldout2025_26Access!==false||
       dev.limitations.bookmakerOutperformanceClaim!==false||
       dev.limitations.independentSealedHoldoutPerformanceClaim!==false||
       dev.limitations.publicPredictionsWritten!==false||
       dev.gates.publicReleaseAuthorized!==false||
       dev.gates.fullM3Accepted!==false)return fail;
    return Object.freeze({state:'verified_retrospective',
      acceptedTechnicalGates:6,totalCorrespondences:1680,
      playedCandidates:1673,excluded:7,
      seasons:Object.freeze(seasons),folds:Object.freeze(folds),
      model:Object.freeze({name:'Team Poisson · shrinkage 12',baseline:'H/D/A · Dirichlet(1,1,1)'}),
      links:Object.freeze({
        development:'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42994112402',
        correlation:'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42995967341',
        source:'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42993521149',
        protocol:'https://github.com/StanleyLl0yd/FootballForecast/issues/271',
        developmentDigest:RUN_HASH,correlationDigest:CORRELATION_HASH}),
      strictAsOf:false,productionApproved:false});
  }catch{return fail;}
}
