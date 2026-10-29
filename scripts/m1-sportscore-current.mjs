// M1: non-persistent, one-day current RPL corroboration via SportScore's free REST API.
// Aggregate diagnostics only. No SportScore raw record mirror, ML use, or bulk history.
import {createHash} from 'node:crypto';
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {discoverRplCompetition} from './m0-sportscore-filtered-rpl-research.mjs';
import {canonicalRplClub,explicitlyLabeledRpl} from './m0-sportscore-day-research.mjs';

const MAX_API=1_000_000,MAX_SEARCH=200_000,MAX_CURRENT=500_000;
const refuse=message=>{throw new Error('M1 SportScore day refused: '+message);};
const pair=(h,a)=>JSON.stringify([h,a]);
const goals=value=>{
  if(Number.isInteger(value)&&value>=0&&value<=20)return value;
  if(typeof value==='string'&&/^(?:0|[1-9]\d?)$/.test(value)&&Number(value)<=20)
    return Number(value);
  return null;
};
function responseFixtures(payload){
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=='object')return null;
  for(const field of ['fixtures','matches','results','data','response']){
    if(Array.isArray(payload[field]))return payload[field];
    const nested=payload[field];
    if(nested&&typeof nested==='object'&&!Array.isArray(nested))
      for(const inner of ['fixtures','matches','results','items'])
        if(Array.isArray(nested[inner]))return nested[inner];
  }
  return null;
}
function jsonlRows(body){
  if(typeof body!=='string'||body.length<1||Buffer.byteLength(body)>MAX_CURRENT)
    refuse('normalized dataset size invalid');
  const lines=body.trimEnd().split('\n');
  if(lines.length>240)refuse('current dataset exceeds 240 matches');
  try{return lines.map(line=>JSON.parse(line));}
  catch{refuse('unparseable normalized dataset');}
}
function dayMillis(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))refuse('invalid UTC calendar day');
  const ms=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)
    refuse('invalid calendar date');
  return ms;
}
export function compareSportScoreCurrent(searchJson,fixtureJson,normalizedCurrentJsonl,
  utcDate,retrievedAtUtc){
  const day=dayMillis(utcDate);
  if(day<dayMillis('2026-07-01')||day>=dayMillis('2027-07-01'))
    refuse('outside current RPL season');
  if(typeof retrievedAtUtc!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(retrievedAtUtc))
    refuse('explicit retrieval UTC required');
  const observed=Date.parse(retrievedAtUtc);
  if(!Number.isFinite(observed)||Math.abs(day-dayMillis(retrievedAtUtc.slice(0,10)))>86400000)
    refuse('only today +/- one UTC day allowed');
  const discovered=discoverRplCompetition(searchJson);
  if(!discovered.selectedSlug)refuse('no unique verified RPL slug');
  const fixtures=responseFixtures(fixtureJson);
  if(!Array.isArray(fixtures)||fixtures.length>200||
    fixtures.some(x=>!x||typeof x!=='object'||Array.isArray(x)))
    refuse('unrecognized or oversized API response');
  const publisher=new Map(),seenPublisher=new Set();
  let publisherUnknown=0;
  for(const row of jsonlRows(normalizedCurrentJsonl)){
    if(row?.season!=='2026/2027'||!row.sourceMatchId||
      !['finished','scheduled','live','cancelled','postponed','awarded'].includes(row.status))
      refuse('invalid current-season normalized fixture');
    const home=canonicalRplClub(row.homeTeam),away=canonicalRplClub(row.awayTeam);
    if(!home||!away||home===away){publisherUnknown++;continue;}
    const key=pair(home,away);
    if(seenPublisher.has(key))refuse('duplicate publisher directed fixture');
    seenPublisher.add(key);
    if(row.calendarDateUtc===utcDate&&row.quarantineReason===null)
      publisher.set(key,row);
  }
  let labeled=0,matched=0,scoreDisagreement=0,missingScores=0,
    unexpectedPairs=0,unmapped=0,duplicate=0,dateDisagreement=0;
  const seenApi=new Set();
  for(const item of fixtures){
    if(!explicitlyLabeledRpl(item))continue;
    labeled++;
    const home=canonicalRplClub(item.home??item.home_team??item.homeTeam);
    const away=canonicalRplClub(item.away??item.away_team??item.awayTeam);
    if(!home||!away||home===away){unmapped++;continue;}
    const key=pair(home,away);
    if(seenApi.has(key)){duplicate++;continue;}
    seenApi.add(key);
    const rawDate=item.time??item.kickoff??item.kickoff_utc??item.date;
    if(typeof rawDate==='string'&&rawDate.trim()){
      const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(rawDate);
      const zoned=/[T ]\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(rawDate);
      const iso=dateOnly?rawDate: zoned&&Number.isFinite(Date.parse(rawDate))?
        new Date(rawDate).toISOString().slice(0,10):null;
      if(iso!==utcDate){dateDisagreement++;continue;}
    }
    const pub=publisher.get(key);
    if(!pub){unexpectedPairs++;continue;}
    matched++;
    if(pub.status==='finished'){
      const hg=goals(item.home_score??item.homeScore??item.goals?.home??item.home?.score);
      const ag=goals(item.away_score??item.awayScore??item.goals?.away??item.away?.score);
      if(hg===null||ag===null)missingScores++;
      else if(hg!==pub.homeGoals||ag!==pub.awayGoals)scoreDisagreement++;
    }
  }
  return {
    schemaVersion:1,kind:'M1_BOUNDED_SPORTSCORE_CURRENT_DAY_CORROBORATION',
    dateUtc:utcDate,retrievedAtUtc,
    provider:'SportScore',documentation:'https://sportscore.com/developers/api/',
    terms:'https://sportscore.com/developers/terms/',
    attribution:'Powered by SportScore',attributionUrl:'https://sportscore.com/',
    source:'Footbolno',footbolnoAttribution:'https://footbolno.ru/otkrytye-dannye',
    searchUniqueRplCompetition:true,
    queriedOneDay:true,sourceMatchesOnDay:publisher.size,
    sportscoreReturned:fixtures.length,sportscoreLabeledRpl:labeled,
    matchedDirectedFixtures:matched,sourceUnmappedTeams:publisherUnknown,
    providerUnmappedTeams:unmapped,duplicateProviderFixtures:duplicate,
    providerOtherOrUnmatchedPairs:unexpectedPairs,
    kickoffDateDisagreements:dateDisagreement,
    missingFinishedScores:missingScores,finishedScoreDisagreements:scoreDisagreement,
    pageCapped:fixtures.length===200,
    dayComparisonStatus:matched>0?'MATCHES_COMPARED':
      publisher.size===0&&labeled===0?'NO_RPL_MATCHES':'INCONCLUSIVE',
    fieldConflictDetected:scoreDisagreement>0||duplicate>0||dateDisagreement>0,
    agreementForMatchedFields:matched>0&&scoreDisagreement===0&&missingScores===0&&
      unmapped===0&&duplicate===0&&dateDisagreement===0,
    fullSeasonVerified:false,upstreamIndependent:false,
    historicalAsOfVerified:false,persistentProviderCache:false,
    trainedOnSportScore:false
  };
}
function boundedFile(path,limit){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const size=fstatSync(fd);
    if(!size.isFile()||size.size<1||size.size>limit)refuse('unsafe input file');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==7)refuse('expected SEARCH_JSON API_DAY_JSON CURRENT_JSONL UTC_DAY RETRIEVED_UTC');
    const searchBytes=boundedFile(process.argv[2],MAX_SEARCH);
    const dayBytes=boundedFile(process.argv[3],MAX_API);
    const currentBytes=boundedFile(process.argv[4],MAX_CURRENT);
    const decode=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const result=compareSportScoreCurrent(JSON.parse(decode(searchBytes)),
      JSON.parse(decode(dayBytes)),decode(currentBytes),process.argv[5],process.argv[6]);
    result.sportscoreResponseSha256=createHash('sha256').update(dayBytes).digest('hex');
    // Numeric report only: never print raw API or match records.
    console.log(JSON.stringify(result,null,2));
    // A fixture-free day or incomplete API response is inconclusive, not a false mismatch.
    if(result.fieldConflictDetected)process.exitCode=1;
  }catch{
    console.error('FAIL: SportScore current-day reconciliation refused without raw response output');
    process.exitCode=2;
  }
}
