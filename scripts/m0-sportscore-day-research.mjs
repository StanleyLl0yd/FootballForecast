// M0 one-shot, bounded comparison ONLY. No HTTP in this module, persistent
// storage, authenticated API, bulk rehosting, model training or predictions.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseBoundedCsv,summarizeFootbolnoRplCsv} from '../apps/web/lib/source-preview-core.mjs';

const SEASON='2026/2027';
const STUDY_DATE='2026-10-22T00:00:00Z';
const DAYS=['2026-10-17','2026-10-18','2026-10-19','2026-10-23','2026-10-24','2026-10-25'];
const clean=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/ё/g,'е')
  .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/^(?:fk|fc|фк) /,'').trim();
const names={
  akhmat:['akhmat','akhmat grozny','ахмат','ахмат грозный'],
  akron:['akron','akron togliatti','akron tolyatti','акрон','акрон тольятти'],
  baltika:['baltika','baltika kaliningrad','балтика','балтика калининград'],
  cska:['cska','cska moskva','cska moscow','цска','цска москва'],
  dinamo_mkh:['dynamo makhachkala','dinamo makhachkala','dynamo makhachkala','динамо махачкала','динамо мх','динамо мхч'],
  dinamo_msk:['dynamo moscow','dinamo moscow','dinamo moskva','динамо москва','динамо м'],
  fakel:['fakel','fakel voronezh','факел','факел воронеж'],
  krasnodar:['krasnodar','fk krasnodar','краснодар'],
  krylia:['krylia sovetov','krylya sovetov','krylia sovetov samara','krylya sovetov samara','крылья советов','крылья советов самара'],
  lokomotiv:['lokomotiv','lokomotiv moscow','lokomotiv moskva','локомотив','локомотив москва'],
  orenburg:['orenburg','orenburg fk','оренбург'],
  rodina:['rodina','rodina moskva','rodina moscow','родина','родина москва'],
  rostov:['rostov','fk rostov','ростов','ростов на дону'],
  rubin:['rubin','rubin kazan','рубин','рубин казань'],
  spartak:['spartak','spartak moskva','spartak moscow','спартак','спартак москва'],
  zenit:['zenit','zenit st petersburg','zenit saint petersburg','зенит','зенит санкт петербург','зенит спб']
};
const aliases=new Map();
for(const [id,values] of Object.entries(names))
  for(const name of values){
    const key=clean(name);
    if(aliases.has(key)&&aliases.get(key)!==id)throw Error('Duplicate club alias');
    aliases.set(key,id);
  }
const club=value=>{
  if(value&&typeof value==='object'&&!Array.isArray(value))
    return aliases.get(clean(value.name??value.title??''))??null;
  return typeof value==='string'?aliases.get(clean(value))??null:null;
};
const text=value=>{
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'&&!Array.isArray(value))
    return [value.name,value.title,value.slug,value.country].filter(x=>typeof x==='string').join(' ');
  return '';
};
const rplCompetition=item=>{
  const name=clean(text(item.competition??item.league??item.tournament));
  // Generic "Premier League" is ambiguous and MUST NOT identify the RPL.
  return /\b(russian premier league|russia premier league|russia premier liga|rpl|российская премьер лига|премьер лига россии|рпл)\b/u.test(name);
};
const extract=payload=>{
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=='object')return null;
  for(const field of ['fixtures','matches','results','data','response']){
    if(Array.isArray(payload[field]))return payload[field];
    if(payload[field]&&typeof payload[field]==='object'){
      for(const inner of ['fixtures','matches','results','items'])
        if(Array.isArray(payload[field][inner]))return payload[field][inner];
    }
  }
  return null;
};
const score=value=>{
  if(Number.isInteger(value)&&value>=0&&value<=20)return value;
  if(typeof value==='string'&&/^(?:0|[1-9]\d?)$/.test(value)&&Number(value)<=20)return Number(value);
  return null;
};
const pair=(h,a)=>h+'|'+a;
function sourceDay(csv,date){
  const {rows,keys}=parseBoundedCsv(csv);
  const items=new Map();
  for(const values of rows){
    const get=k=>typeof keys[k]==='number'?values[keys[k]]?.trim()??'':'';
    if(get('league_id')!=='235'||get('season')!==SEASON||get('date_utc').slice(0,10)!==date)continue;
    const home=club(get('home')),away=club(get('away'));
    if(!home||!away||home===away)throw Error('Unrecognized source-team alias');
    const key=pair(home,away);
    if(items.has(key))throw Error('Duplicate RPL source fixture');
    items.set(key,{
      status:get('status'),
      homeGoals:score(get('home_goals')),
      awayGoals:score(get('away_goals'))
    });
  }
  return items;
}
/**
 * A single-day public REST v1 response. Inspect known, explicit RPL labels
 * only. All unknown envelopes/competitions/teams are INCONCLUSIVE, never FAIL
 * evidence for the league's true schedule. No provider match rows or names
 * escape the returned aggregate.
 */
export function compareSportScoreDay(csv,date,payload){
  if(!DAYS.includes(date))throw Error('Day outside six-day research window');
  const source=sourceDay(csv,date);
  const list=extract(payload);
  const recognized=Array.isArray(list)&&list.length<=200&&list.every(x=>x&&typeof x==='object'&&!Array.isArray(x));
  if(!recognized)return {
    date,footbolnoFixtures:source.size,apiSchemaRecognized:false,
    sportscoreReturnedFixtures:null,apiLimitReached:null,rplExplicitlyLabeled:null,
    candidateClubMatches:null,pairsMatchingSource:null,
    differentFinishedScores:null,unmappedOrAmbiguous:null,
    scheduleCoverageVerified:false,matchTruthVerified:false
  };
  let explicit=0,mapped=0,pairs=0,differing=0,unknown=0,duplicate=0;
  const seen=new Set();
  for(const item of list){
    if(!rplCompetition(item))continue;
    explicit++;
    const home=club(item.home??item.home_team??item.homeTeam);
    const away=club(item.away??item.away_team??item.awayTeam);
    if(!home||!away||home===away){unknown++;continue}
    mapped++;
    const key=pair(home,away);
    if(seen.has(key)){duplicate++;continue}
    seen.add(key);
    const expected=source.get(key);
    if(!expected)continue;
    pairs++;
    if(expected.status==='finished'){
      const gh=score(item.home_score??item.homeScore??item.goals?.home);
      const ga=score(item.away_score??item.awayScore??item.goals?.away);
      if(gh===null||ga===null){unknown++;continue}
      if(gh!==expected.homeGoals||ga!==expected.awayGoals)differing++;
    }
  }
  return {
    date,footbolnoFixtures:source.size,apiSchemaRecognized:true,
    sportscoreReturnedFixtures:list.length,
    apiLimitReached:list.length>=200,
    rplExplicitlyLabeled:explicit,candidateClubMatches:mapped,
    pairsMatchingSource:pairs,differentFinishedScores:differing,
    unmappedOrAmbiguous:unknown+duplicate,
    // A day query may be clipped/unclear; matched rows are observations only.
    scheduleCoverageVerified:false,matchTruthVerified:false
  };
}
export function runDayProbe(csv,days){
  if(!Array.isArray(days)||days.length!==DAYS.length||
      DAYS.some((d,i)=>days[i]?.date!==d))
    throw Error('Exactly six explicitly approved UTC day probes required');
  const baseline=summarizeFootbolnoRplCsv(csv,STUDY_DATE);
  const season=baseline.seasonSummaries.find(x=>x.season===SEASON);
  if(!season?.structuralCandidate||season.distinctClubCount!==16||
     season.distinctDirectedPairs!==240)
    throw Error('Reference 2026/27 CSV is not structurally complete');
  const results=days.map(({date,httpStatus,payload})=>{
    if(httpStatus!==200)return {
      date,transportHttpStatus:Number.isInteger(httpStatus)?httpStatus:0,
      reachable:false,sourceAvailabilityVerified:false,footbolnoFixtures:sourceDay(csv,date).size
    };
    return {transportHttpStatus:200,reachable:true,
      ...compareSportScoreDay(csv,date,payload)};
  });
  return {
    schemaVersion:1,kind:'M0_SPORTSCORE_BOUNDED_CURRENT_RPL_RESEARCH',
    source:'https://sportscore.com/developers/api/',
    attribution:'https://sportscore.com/',
    apiSourceScope:'six anonymous one-day GET requests',
    observationWindow:DAYS,
    footbolnoSeason:'2026/2027',
    footbolnoSeasonRowCount:season.matches,
    footbolnoFinishedCount:season.finished,
    footbolnoScheduledCount:season.scheduled,
    days:results,
    anyExplicitRplMatchesObserved:results.some(x=>(x.rplExplicitlyLabeled??0)>0),
    providerCoverageCertified:false,providerTermsPriorityResolved:false,
    rightsForBulkExtractionOrModelTrainingVerified:false,
    historicalAsOfPublicationVerified:false,productionIntegrationEnabled:false,
    rawProviderDataStored:false
  };
}
function main(){
  if(process.argv.length!==4)throw Error('Usage: node probe.mjs CSV MANIFEST');
  const csvBytes=readFileSync(process.argv[2]);
  if(csvBytes.length>2_000_000)throw Error('Source exceeds 2 MB budget');
  const manifest=JSON.parse(readFileSync(process.argv[3],'utf8'));
  if(!Array.isArray(manifest)||manifest.length!==DAYS.length)
    throw Error('Invalid manifest');
  const days=manifest.map((x,i)=>{
    if(x?.date!==DAYS[i]||!Number.isInteger(x.status))throw Error('Day manifest mismatched');
    if(x.status!==200)return {date:x.date,httpStatus:x.status};
    const bytes=readFileSync(x.file);
    if(bytes.length>1_000_000)throw Error('Provider day exceeds 1 MB cap');
    let parsed;
    try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
    catch{parsed=null}
    return {date:x.date,httpStatus:200,payload:parsed};
  });
  console.log(JSON.stringify(runDayProbe(new TextDecoder('utf-8',{fatal:true})
    .decode(csvBytes),days),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main()}catch{
    console.error('FAIL: bounded SportScore day research refused, no provider rows exposed');
    process.exitCode=2;
  }
}
