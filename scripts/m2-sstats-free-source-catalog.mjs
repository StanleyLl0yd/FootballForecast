// Bounded official SStats.net metadata-only RPL research. Never emits league IDs,
// team IDs, match identifiers, player data, odds or source rows to GitHub logs.
import {createHash} from 'node:crypto';
import {constants, openSync, fstatSync, readFileSync, closeSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const error=()=>{throw Error('INCONCLUSIVE_SSTATS_UNTRUSTED_SCHEMA');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'?x.normalize('NFKC').trim().toLowerCase():'';
const id=x=>Number.isSafeInteger(x)&&x>0&&x<100000000;
const hash=x=>createHash('sha256').update(x).digest('hex');
const fields=Object.freeze({
  venue:r=>[r.venue,r.stadium],
  coaches:r=>[r.coach,r.coaches,r.homeCoach,r.awayCoach],
  lineups:r=>[r.lineup,r.lineups,r.homeLineup,r.awayLineup],
  players:r=>[r.players,r.playerStats],
  xg:r=>[r.xg,r.xG,r.expectedGoals,r.homeXg,r.awayXg],
  shots:r=>[r.shots,r.homeShots,r.awayShots],
  prematchOdds:r=>[r.prematchOdds,r.odds,r.betOdds],
  quoteObservationTimestamp:r=>[r.oddsRecordedAt,r.oddsUpdatedAt,r.quoteTime],
});
const meaningful=x=>x!=null&&(Array.isArray(x)?x.length>0:
  object(x)?Object.keys(x).length>0:typeof x==='number'?Number.isFinite(x):
  typeof x==='string'?x.trim().length>0:false);

function records(doc){
  if(Array.isArray(doc))return doc;
  if(!object(doc))error();
  for(const value of [doc.data,doc.leagues,doc.games,doc.items,
    doc.data?.items,doc.data?.games,doc.data?.leagues,doc.results]){
    if(Array.isArray(value))return value;
  }
  return null;
}
function country(league){
  const c=league.country??league.countryName??league.Country??league.CountryName;
  if(object(c))return text(c.name??c.Name??c.countryName??c.title);
  return text(c);
}
function leagueName(league){
  return text(league.name??league.Name??league.leagueName??league.LeagueName??
    league.title??league.strLeague);
}
function leagueId(l){
  const v=l.id??l.Id??l.leagueId??l.LeagueId??l.idLeague;
  return typeof v==='string'&&/^[0-9]{1,8}$/.test(v)?Number(v):v;
}
function time(value){
  return typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value)&&
    !Number.isNaN(Date.parse(value));
}
/** Diagnostics intentionally disclose only structural types/booleans and a digest.
 * Provider messages, names, record values and keys outside an allowlist stay private.
 */
export function describeSstatsCatalogEnvelope(doc,observedAtUtc){
  if(!time(observedAtUtc))error();
  const type=x=>Array.isArray(x)?'array':x===null?'null':typeof x;
  const keys=['data','leagues','items','results','status','count','TotalCount',
    'message','error','success','response','payload'];
  const present=Object.fromEntries(keys.map(k=>[k,object(doc)&&
    Object.prototype.hasOwnProperty.call(doc,k)]));
  const data=object(doc)?doc.data:undefined;
  const nestedArrayLengths=object(data)?Object.values(data)
    .filter(Array.isArray).map(a=>a.length).slice(0,8):[];
  const statusValue=object(doc)?text(doc.status):'';
  return Object.freeze({
    schemaVersion:1,kind:'M2_SSTATS_PUBLIC_CATALOG_ENVELOPE_DIAGNOSTIC',
    observedAtUtc,
    rootType:type(doc),
    rootKeyCount:object(doc)?Object.keys(doc).length:null,
    recognizedKeyPresence:present,
    dataType:type(data),
    nestedArraysCount:object(data)?Object.values(data).filter(Array.isArray).length:0,
    nestedArrayLengths,
    statusClass:['ok','success','error','fail','failed'].includes(statusValue)?
      statusValue:'UNCLASSIFIED',
    actualProviderMessageLogged:false,
    sourceIdentifiersLogged:false,
    metadataOnly:true,
    leagueSelectionApproved:false,
    modelTrainingApproved:false,
    sealedHoldoutRead:false,
  });
}

export function examineSstatsCatalog(doc,observedAtUtc){
  if(!time(observedAtUtc))error();
  const rows=records(doc);
  if(rows===null||rows.length===0||rows.length>5000)error();
  const candidates=[];
  for(const row of rows){
    if(!object(row))continue;
    const name=leagueName(row),nation=country(row);
    const russia=/russia|russian|росси/u.test(nation)||/russia|russian|росси/u.test(name);
    const premier=/premier|премьер|premyer|premjer/u.test(name);
    if(!russia||!premier)continue;
    const found=leagueId(row);
    if(id(found)&&!candidates.includes(found))candidates.push(found);
  }
  return Object.freeze({
    schemaVersion:1,kind:'M2_SSTATS_RPL_OFFICIAL_FREE_CATALOG_PROBE',
    observedAtUtc,source:'SStats.net documented public API',leagueRowsSeen:rows.length,
    russianPremierCandidates:candidates.length,uniqueLeagueIdFound:candidates.length===1,
    // Only the private runner may use this ID for one additional bounded GET.
    _internalLeagueId:candidates.length===1?candidates[0]:null,
    rplHistoricalMatchCoverageVerified:false,rightsForTrainingVerified:false,
    asOfOddsVerified:false,sourceMatchValuesLogged:false,holdoutRead:false,
  });
}
export function examineSstatsGames(doc,observedAtUtc){
  if(!time(observedAtUtc))error();
  const rows=records(doc);
  if(rows===null||rows.length>500||rows.some(r=>!object(r)))error();
  const fieldCounts=Object.fromEntries(Object.keys(fields).map(k=>[k,0]));
  for(const r of rows)for(const [name,lookup] of Object.entries(fields)){
    if(lookup(r).some(meaningful))fieldCounts[name]++;
  }
  return Object.freeze({
    schemaVersion:1,kind:'M2_SSTATS_RPL_2022_SOURCE_FIELD_SAMPLE',
    observedAtUtc,requestedSeasonStartYear:2022,
    returnedSampleRows:rows.length,fieldsDetectedRowCounts:fieldCounts,
    emptyOrPagedResponseMayBeIncomplete:true,
    rplLeagueConfirmedByIndependentID:false,
    fullSeasonCoverageVerified:false,
    sourceRightsForTrainingVerified:false,
    quoteHistoricalAsOfVerified:false,
    sourceRowsPersisted:false,holdoutRead:false,
  });
}
function readSafe(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>1500000)error();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const mode=process.argv[2];
    if(mode==='catalog'&&process.argv.length===6){
      const raw=readSafe(process.argv[3]);
      const doc=JSON.parse(raw.toString('utf8'));
      let x;
      try{
        x=examineSstatsCatalog(doc,process.argv[4]);
      }catch{
        console.log(JSON.stringify({
          ...describeSstatsCatalogEnvelope(doc,process.argv[4]),
          catalogSchemaStatus:'INCONCLUSIVE_UNRECOGNIZED_JSON_ENVELOPE',
          responseSha256:hash(raw),
        }));
        process.exit(0);
      }
      if(x._internalLeagueId!==null){
        writeFileSync(process.argv[5],String(x._internalLeagueId)+'\n',{mode:0o600,flag:'wx'});
      }
      const {_internalLeagueId,...aggregate}=x;
      console.log(JSON.stringify({...aggregate,responseSha256:hash(raw)}));
    }else if(mode==='games'&&process.argv.length===5){
      const raw=readSafe(process.argv[3]);
      console.log(JSON.stringify({
        ...examineSstatsGames(JSON.parse(raw.toString('utf8')),process.argv[4]),
        responseSha256:hash(raw),
      }));
    }else error();
  }catch{
    console.error('M2 SStats metadata-only probe inconclusive; no source rows emitted');
    process.exitCode=2;
  }
}
