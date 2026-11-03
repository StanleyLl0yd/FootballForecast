// M2: public, one-day, SportScore-only availability/coverage observation.
// No Footbolno dependency, Supabase access, row persistence or model training.
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {discoverRplCompetition} from './m0-sportscore-filtered-rpl-research.mjs';
import {canonicalRplClub,explicitlyLabeledRpl} from './m0-sportscore-day-research.mjs';

const SEARCH_BYTES=200_000,DAY_BYTES=1_000_000;
const fail=reason=>{throw Error('M2 SportScore observation refused: '+reason);};
const dateValue=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const score=s=>Number.isInteger(s)&&s>=0&&s<=20||
  typeof s==='string'&&/^(?:0|[1-9]\d?)$/.test(s)&&Number(s)<=20;
const pair=(h,a)=>JSON.stringify([h,a]);
function fixtures(payload){
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  for(const key of ['fixtures','matches','results','data','response']){
    if(Array.isArray(payload[key]))return payload[key];
    const nested=payload[key];
    if(nested&&typeof nested==='object'&&!Array.isArray(nested))
      for(const inner of ['fixtures','matches','results','items'])
        if(Array.isArray(nested[inner]))return nested[inner];
  }
  return null;
}
function isoDay(value){
  if(typeof value!=='string'||!value.trim())return null;
  if(dateValue(value))return value;
  if(!/^20\d{2}-\d\d-\d\d[T ]\d\d:\d\d/.test(value)||
     !/(?:Z|[+-]\d\d:\d\d)$/.test(value))return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,10):null;
}

/** Return only bounded non-identifying counts from ONE user-triggered day.
 * No status/scores are accepted as official match truth or historical as-of data.
 */
export function summarizeSportScoreCurrentDay(search,body,utcDate,observedUtc){
  if(!dateValue(utcDate)||utcDate<'2026-07-01'||utcDate>='2027-07-01')
    fail('day outside current-season contract');
  if(typeof observedUtc!=='string'||
     !/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observedUtc)||
     !Number.isFinite(Date.parse(observedUtc))||
     new Date(observedUtc).toISOString()!==observedUtc.replace('Z','.000Z'))
    fail('explicit canonical observed UTC required');
  if(utcDate!==observedUtc.slice(0,10))
    fail('only the current UTC day may be observed');
  const found=discoverRplCompetition(search);
  if(!found.selectedSlug)fail('no uniquely authenticated RPL competition filter');
  const rows=fixtures(body);
  if(!Array.isArray(rows)||rows.length>200||
     rows.some(x=>!x||typeof x!=='object'||Array.isArray(x)))
    fail('invalid or oversized provider response');
  let labeled=0,mapped=0,dated=0,unknownTeams=0,unknownDates=0,
    invalidDates=0,duplicates=0,observedScorePairs=0;
  const seen=new Set();
  for(const row of rows){
    if(!explicitlyLabeledRpl(row))continue;
    labeled++;
    const home=canonicalRplClub(row.home??row.home_team??row.homeTeam);
    const away=canonicalRplClub(row.away??row.away_team??row.awayTeam);
    if(!home||!away||home===away){unknownTeams++;continue;}
    mapped++;
    const calendar=isoDay(row.time??row.kickoff??row.kickoff_utc??row.date);
    if(calendar===null){unknownDates++;continue;}
    if(calendar!==utcDate){invalidDates++;continue;}
    const key=pair(home,away);
    if(seen.has(key)){duplicates++;continue;}
    seen.add(key);dated++;
    if(score(row.home_score??row.homeScore??row.goals?.home??row.home?.score)&&
       score(row.away_score??row.awayScore??row.goals?.away??row.away?.score))
      observedScorePairs++;
  }
  return {
    schemaVersion:1,kind:'M2_SPORTSCORE_SINGLE_DAY_RESEARCH_OBSERVATION',
    provider:'SportScore',attribution:'Powered by SportScore',
    attributionUrl:'https://sportscore.com/',
    terms:'https://sportscore.com/developers/terms/',
    dateUtc:utcDate,observedUtc,
    exactRplCompetitionDiscovered:true,
    requestedDays:1,returnedRows:rows.length,explicitRplRows:labeled,
    recognizedClubPairs:mapped,dateMatchedUniquePairs:dated,
    scoreFieldsObservedNotVerified:observedScorePairs,
    unrecognizedTeams:unknownTeams,missingOrInvalidDates:unknownDates,
    outOfDayRecords:invalidDates,duplicateDirectedFixtures:duplicates,
    providerPageAtCap:rows.length===200,
    interpretation:rows.length===200||duplicates>0||invalidDates>0||
      unknownDates>0||unknownTeams>0||(rows.length>0&&labeled===0)?'INCONCLUSIVE':
      dated>0?'PARTIAL_RESEARCH_OBSERVATION':'NO_VERIFIED_CURRENT_DAY_RPL_OBSERVATIONS',
    originalResultAuthorityVerified:false,completeDayCoverageVerified:false,
    completeSeasonCoverageVerified:false,independentUpstreamVerified:false,
    preMatchAvailabilityVerified:false,
    recurringBulkExtractionAuthorized:false,
    modelTrainingAuthorized:false,databaseWrites:0,
    publishedForecasts:0,holdoutRead:false,
    privateRowsPersisted:false
  };
}
function readJson(path,cap){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||!stat.size||stat.size>cap)fail('bounded regular file required');
    const bytes=readFileSync(fd);
    return {bytes,json:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==6)
      fail('usage: SEARCH_JSON DAY_JSON CURRENT_UTC_DATE OBSERVED_UTC');
    const search=readJson(process.argv[2],SEARCH_BYTES);
    const daily=readJson(process.argv[3],DAY_BYTES);
    const report=summarizeSportScoreCurrentDay(
      search.json,daily.json,process.argv[4],process.argv[5]);
    // Fingerprint only; no provider match rows or identities enter stdout/artifacts.
    report.responseSha256=createHash('sha256').update(daily.bytes).digest('hex');
    console.log(JSON.stringify(report));
  }catch{
    console.error('FAIL: M2 bounded SportScore observation refused; no provider rows emitted');
    process.exitCode=2;
  }
}
