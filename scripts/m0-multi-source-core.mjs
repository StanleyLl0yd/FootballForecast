// Shared M0 pure deterministic quality auditor for browser and Node.
// It never fetches a source or authenticates rights, observations, or as-of timestamps.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const bounded=(x,max=256)=>typeof x==='string'&&x.length>0&&x.length<=max&&x===x.trim();
const utc=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&
  !Number.isNaN(Date.parse(x))&&new Date(x).toISOString().replace('.000Z','Z')===x;
const goal=n=>Number.isInteger(n)&&n>=0&&n<=99;
const statuses=new Set(['played','awarded','postponed','cancelled']);
const fail=message=>{throw new Error('Invalid supplied evidence: '+message)};

function validateMatch(item,context){
  if(!object(item))fail(context+' must be an object');
  for(const field of ['homeId','awayId'])if(!bounded(item[field],80))fail(context+' invalid '+field);
  if(item.homeId===item.awayId)fail(context+' identical home and away');
  if(!utc(item.kickoffAt))fail(context+' invalid kickoff');
  if(!statuses.has(item.status))fail(context+' invalid status');
  if(item.status==='played'||item.status==='awarded'){
    if(!goal(item.homeGoals)||!goal(item.awayGoals))fail(context+' must have valid scores');
  }else if(item.homeGoals!==null||item.awayGoals!==null)
    fail(context+' must have null scores for unplayed games');
}
function interval(errors,n){
  if(n===0)return null;
  const z=1.959963984540054,z2=z*z,p=errors/n,den=1+z2/n;
  const center=(p+z2/(2*n))/den;
  const half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/den;
  return {lower:Math.max(0,center-half),upper:Math.min(1,center+half)};
}
const metric=(errors,n)=>({compared:n,errors,errorRate:n?errors/n:null,interval95:interval(errors,n)});
const counters=()=>({missing:0,reported:0,orientation:0,kickoff:0,status:0,
  eligibleScore:0,scoreDifferences:0,completedReference:0,completeErrors:0,
  temporalDemonstrated:0,temporalNotDemonstrated:0,
  upstreamGroups:new Set(),unresolvedUpstream:0});

/** Strict local comparison. A supplied official URL is not verified by this function.
 * Input: {schemaVersion:1,cases:[{key,officialEvidenceUrl,official,
 *   observations:[{sourceId,publisherGroup,publishedAt,observedAt,
 *     homeId,awayId,kickoffAt,status,homeGoals,awayGoals}]}]}.
 * Use null publisherGroup/publishedAt for unknown values, not invented provenance.
 */
export function evaluateSourceEvidenceCore(input,registry,{minimumScoredMatches=30}={}){
  if(!Number.isSafeInteger(minimumScoredMatches)||minimumScoredMatches<1||minimumScoredMatches>10000)
    throw new RangeError('Invalid minimumScoredMatches');
  if(!object(input)||input.schemaVersion!==1||!Array.isArray(input.cases)||input.cases.length>20000)
    fail('schema/version/case count');
  if(!object(registry)||!Array.isArray(registry.sources)||registry.policy?.maxMonthlySpendUSD!==0)
    fail('free-only source registry');
  const knownSources=new Map(registry.sources.map(x=>[x.id,x]));
  const seenCases=new Set(),sourceIds=new Set(),totals=new Map();
  for(const [i,item] of input.cases.entries()){
    const where='case '+i;
    if(!object(item)||!bounded(item.key,128)||seenCases.has(item.key))
      fail(where+' key duplicated/invalid');
    seenCases.add(item.key);
    if(!bounded(item.officialEvidenceUrl,500)||!/^https:\/\//.test(item.officialEvidenceUrl))
      fail(where+' missing primary evidence URL');
    validateMatch(item.official,where+' official');
    if(!Array.isArray(item.observations)||item.observations.length>64)
      fail(where+' observations');
    const ids=new Set();
    for(const [j,row] of item.observations.entries()){
      const at=where+' observation '+j;
      if(!object(row)||!bounded(row.sourceId,80))fail(at+' sourceId');
      const source=knownSources.get(row.sourceId);
      if(!source||source.active||source.authorizedAutomatedTraining||!Number.isInteger(source.priority))
        fail(at+' not in the inactive zero-cost source registry');
      if(ids.has(row.sourceId))fail(at+' duplicate source snapshot');
      ids.add(row.sourceId);sourceIds.add(row.sourceId);
      validateMatch(row,at);
      if(row.publisherGroup!==null&&!bounded(row.publisherGroup,80))
        fail(at+' upstream group');
      if(row.publishedAt!==null&&!utc(row.publishedAt))fail(at+' publishedAt');
      if(!utc(row.observedAt))fail(at+' observedAt');
      if(row.publishedAt!==null&&Date.parse(row.publishedAt)>Date.parse(row.observedAt))
        fail(at+' publication follows observation');
      if(['played','awarded'].includes(row.status)&&Date.parse(row.observedAt)<Date.parse(row.kickoffAt))
        fail(at+' finished match observed before kickoff');
    }
  }
  for(const id of sourceIds)totals.set(id,counters());
  for(const entry of input.cases){
    const rows=new Map(entry.observations.map(row=>[row.sourceId,row]));
    const official=entry.official;
    for(const [id,t] of totals){
      const row=rows.get(id);
      // Every finished official-reference case contributes to the same denominator.
      // Missing, reversed, incorrectly dated/statused or wrong-scored observations
      // are full-fixture errors, never removed from the ranking sample.
      if(['played','awarded'].includes(official.status)){
        t.completedReference++;
        if(!row||row.homeId!==official.homeId||row.awayId!==official.awayId||
          row.kickoffAt!==official.kickoffAt||row.status!==official.status||
          row.homeGoals!==official.homeGoals||row.awayGoals!==official.awayGoals)
          t.completeErrors++;
      }
      if(!row){t.missing++;continue}
      t.reported++;
      const reversed=row.homeId!==official.homeId||row.awayId!==official.awayId;
      if(reversed)t.orientation++;
      if(row.kickoffAt!==official.kickoffAt)t.kickoff++;
      if(row.status!==official.status)t.status++;
      if(row.publisherGroup===null)t.unresolvedUpstream++;
      else t.upstreamGroups.add(row.publisherGroup);
      if(row.publishedAt!==null&&Date.parse(row.publishedAt)<=Date.parse(official.kickoffAt)&&
        Date.parse(row.observedAt)<=Date.parse(official.kickoffAt))t.temporalDemonstrated++;
      else t.temporalNotDemonstrated++;
      // Compare final scores only with correct home/away orientation and same completed status.
      if(!reversed&&['played','awarded'].includes(official.status)&&row.status===official.status){
        t.eligibleScore++;
        if(row.homeGoals!==official.homeGoals||row.awayGoals!==official.awayGoals)
          t.scoreDifferences++;
      }
    }
  }
  const sources=[...totals].map(([sourceId,t])=>({
    sourceId,observed:t.reported,missing:t.missing,referenceCases:input.cases.length,
    coverageRate:input.cases.length?t.reported/input.cases.length:null,
    matchOrientation:metric(t.orientation,t.reported),kickoff:metric(t.kickoff,t.reported),
    status:metric(t.status,t.reported),finalScore:metric(t.scoreDifferences,t.eligibleScore),
    fixtureIntegrity:metric(t.completeErrors,t.completedReference),
    unscoredFinals:t.reported-t.eligibleScore,
    temporalAvailability:{demonstratedBySuppliedTimestamps:t.temporalDemonstrated,
      notDemonstrated:t.temporalNotDemonstrated,historicalProvenanceAuthenticated:false},
    upstream:{declaredGroups:[...t.upstreamGroups].sort(),
      unresolvedObservations:t.unresolvedUpstream,independenceAuthenticated:false},
    provisionalScoreRankEligible:t.eligibleScore>=minimumScoredMatches
  })).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
  // Distinct field-specific provisional rankings with denominators. No synthetic global score.
  const fieldRankings=Object.fromEntries(['fixtureIntegrity','finalScore','matchOrientation','kickoff','status']
    .map(field=>[field,sources.filter(s=>s[field].compared>=minimumScoredMatches)
      .sort((a,b)=>a[field].errorRate-b[field].errorRate||
        b[field].compared-a[field].compared||a.sourceId.localeCompare(b.sourceId))
      .map(s=>({sourceId:s.sourceId,compared:s[field].compared,
        errorRate:s[field].errorRate,interval95:s[field].interval95}))]));
  return {
    schemaVersion:1,interpretation:'RESEARCH_ONLY_SUPPLIED_EVIDENCE_NOT_AUTHENTICATED',
    sourceApproval:false,sourceRightsApproved:false,officialReferenceAuthenticityVerified:false,
    upstreamIndependenceVerified:false,enabledForTraining:false,eligibleForProduction:false,
    observationCount:input.cases.length,sources,fieldRankings,
    rankingBasis:'Fixture integrity uses identical finished reference denominator, counting missing/reversed/wrong-score as errors; per-field conditional rates are separate. All research-only',
    minimumScoredMatches
  };
}
