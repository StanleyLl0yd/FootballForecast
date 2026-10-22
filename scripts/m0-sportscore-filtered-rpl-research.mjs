// One-time, explicitly bounded REST v1 discovery: one search GET and up to
// six COMPETITION-FILTERED one-day GETs. Never persist or log provider rows.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runDayProbe} from './m0-sportscore-day-research.mjs';

const MAX_SEARCH=200_000,MAX_DAY=1_000_000;
const DATES=['2026-10-17','2026-10-18','2026-10-19',
  '2026-10-23','2026-10-24','2026-10-25'];
const canonical=s=>String(s??'').normalize('NFKC').toLowerCase()
  .replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const countryText=x=>typeof x==='string'?x:x&&typeof x==='object'?
  String(x.name??x.title??x.code??''):'';
const sourceItems=json=>{
  if(!json||typeof json!=='object'||Array.isArray(json))return null;
  const parent=json.results??json.data??json;
  if(!parent||typeof parent!=='object'||Array.isArray(parent))return null;
  for(const field of ['competitions','leagues','tournaments']){
    if(Array.isArray(parent[field])&&parent[field].length<=20)
      return parent[field];
  }
  return null;
};
const exactRpl=item=>{
  const league=canonical(item.name??item.title??item.label);
  const country=canonical(countryText(item.country??item.country_name));
  return new Set(['russian premier league','russia premier league',
    'russian premier liga','российская премьер лига','рпл']).has(league)||
    (league==='premier league'&&new Set(['russia','россия','ru','rus']).has(country));
};
export function discoverRplCompetition(json){
  const entries=sourceItems(json);
  if(!entries)return {searchSchemaRecognized:false,searchCandidates:null,
    exactRplCandidates:null,selectedSlug:null};
  const valid=entries.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
  const candidates=valid.filter(exactRpl);
  const slugs=[...new Set(candidates.map(x=>x.slug)
    .filter(s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(s)))];
  return {
    searchSchemaRecognized:true,
    searchCandidates:valid.length,
    exactRplCandidates:candidates.length,
    selectedSlug:candidates.length===1&&slugs.length===1?slugs[0]:null
  };
}
const parseBounded=(path,budget)=>{
  const bytes=readFileSync(path);
  if(bytes.length===0||bytes.length>budget)throw Error('Research response outside byte budget');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  return JSON.parse(text);
};
function discoverCli(searchFile,slugFile){
  let report={searchSchemaRecognized:false,searchCandidates:null,
    exactRplCandidates:null,selectedSlug:null};
  try{report=discoverRplCompetition(parseBounded(searchFile,MAX_SEARCH))}
  catch{/* missing/invalid search JSON: no slug; no raw values in errors */}
  writeFileSync(slugFile,report.selectedSlug??'',{mode:0o600});
  console.log(JSON.stringify({kind:'M0_SPORTSCORE_RPL_SLUG_DISCOVERY',
    searchSchemaRecognized:report.searchSchemaRecognized,
    searchCandidates:report.searchCandidates,
    exactRplCandidates:report.exactRplCandidates,
    validatedCompetitionFilterAvailable:report.selectedSlug!==null,
    rawResultsPersisted:false,productionRightsApproved:false},null,2));
}
export function compareFilteredSixDays(csv,search,manifest){
  const candidate=discoverRplCompetition(search);
  if(!candidate.selectedSlug)throw Error('Verified unique competition slug required');
  if(!Array.isArray(manifest)||manifest.length!==6)throw Error('Expected exactly six days');
  const days=manifest.map((row,i)=>{
    if(!row||row.date!==DATES[i]||!Number.isInteger(row.status))
      throw Error('Wrong fixed UTC day');
    return {date:row.date,httpStatus:row.status,payload:row.payload??null};
  });
  const evidence=runDayProbe(csv,days);
  const total=evidence.days.reduce((sum,x)=>sum+(x.pairsMatchingSource??0),0);
  const matchedDays=evidence.days.filter(x=>(x.pairsMatchingSource??0)>0).length;
  const pagesCapped=evidence.days.filter(x=>x.apiLimitReached===true).length;
  const dailyResults=evidence.days.map(x=>({
    date:x.date,status:x.transportHttpStatus,
    sourceFixtures:x.footbolnoFixtures,
    returnedFixtures:x.sportscoreReturnedFixtures??null,
    labeledRpl:x.rplExplicitlyLabeled??null,
    matchedPairs:x.pairsMatchingSource??null,
    finishedScoreMismatches:x.differentFinishedScores??null,
    pageCapped:x.apiLimitReached??null,
    unknownSchema:x.apiSchemaRecognized===false,
    unresolvedRows:x.unmappedOrAmbiguous??null
  }));
  return {
    schemaVersion:1,kind:'M0_RPL_SPORTSCORE_FILTERED_DAY_COMPARISON',
    source:'https://sportscore.com/developers/api/',
    attribution:'https://sportscore.com/',
    selectedByUniqueSearchResult:true,
    slugValuePublished:false,approvedQueryDates:DATES,
    totalMatchedPairs:total,daysWithMatchingPairs:matchedDays,
    daysAtPageCap:pagesCapped,
    sourceSeasonFixtures:evidence.footbolnoSeasonRowCount,
    providerCompleteCoverageVerified:false,
    repeatedNetworkObservationsAuthorized:false,
    independentUpstreamTruthVerified:false,
    freeModelTrainingRightsVerified:false,
    productionIntegrationEnabled:false,rawRecordsPersisted:false,
    days:dailyResults
  };
}
function researchCli(csvFile,searchFile,manifestFile){
  const search=parseBounded(searchFile,MAX_SEARCH);
  const manifest=JSON.parse(readFileSync(manifestFile,'utf8'));
  const days=manifest.map((x,i)=>{
    if(!x||x.date!==DATES[i]||!Number.isInteger(x.status))
      throw Error('Invalid fixed-day manifest');
    if(x.status!==200)return {date:x.date,status:x.status};
    let payload=null;
    try{payload=parseBounded(x.file,MAX_DAY)}
    catch{/* invalid/truncated third-party JSON remains inconclusive */}
    return {date:x.date,status:200,payload};
  });
  const csvBytes=readFileSync(csvFile);
  if(csvBytes.length===0||csvBytes.length>2_000_000)
    throw Error('Source CSV exceeds budget');
  const result=compareFilteredSixDays(
    new TextDecoder('utf-8',{fatal:true}).decode(csvBytes),search,days);
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv[2]==='discover'&&process.argv.length===5)
      discoverCli(process.argv[3],process.argv[4]);
    else if(process.argv[2]==='research'&&process.argv.length===6)
      researchCli(process.argv[3],process.argv[4],process.argv[5]);
    else throw Error('Unknown bounded research invocation');
  }catch{
    console.error('FAIL: filtered RPL day research refused without exposing source contents');
    process.exitCode=2;
  }
}
