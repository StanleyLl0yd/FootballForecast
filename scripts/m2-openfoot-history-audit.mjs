// Bounded private RPL historical research discovery. Samples only, no training or holdout reads.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const HISTORICAL_SEASONS=Object.freeze(
  Array.from({length:7},(_,i)=>{
    const year=2018+i;
    return String(year)+'/'+String((year+1)%100).padStart(2,'0');
  })
);
const COMPETITION='comp_premier_league_rus';
const STATES=new Set(['scheduled','live','finished','postponed','cancelled','unknown']);
const fail=()=>{throw Error('M2 RPL historical discovery refused untrusted input');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safeId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,160}$/.test(x);
const observedAt=x=>typeof x==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&
  !Number.isNaN(Date.parse(x))&&new Date(x).toISOString()===x.replace('Z','.000Z');
const isEmpty=x=>x===undefined||x===null||
  Array.isArray(x)&&x.length===0||obj(x)&&Object.keys(x).length===0;

function checkSeasonPage(doc,season){
  if(!obj(doc)||!Array.isArray(doc.data)||doc.data.length>50||!obj(doc.meta)||
     !obj(doc.meta.access)||doc.meta.access.authenticated!==true||
     doc.meta.access.plan!=='starter'||doc.meta.count!==doc.data.length)fail();
  const ids=new Set(),teams=new Set();
  const year=Number(season.slice(0,4));
  let kickoffKnown=0,finished=0;
  for(const row of doc.data){
    if(!obj(row)||!safeId(row.id)||ids.has(row.id)||
       row.competitionId!==COMPETITION||
       row.season!==season||!STATES.has(row.status)||
       !obj(row.homeTeam)||!obj(row.awayTeam)||
       !safeId(row.homeTeam.id)||!safeId(row.awayTeam.id)||
       row.homeTeam.id===row.awayTeam.id)fail();
    ids.add(row.id);teams.add(row.homeTeam.id);teams.add(row.awayTeam.id);
    if(row.status==='finished')finished++;
    if(row.kickoffAt!==null&&row.kickoffAt!==undefined){
      if(typeof row.kickoffAt!=='string'||
         !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(row.kickoffAt)||
         Number.isNaN(Date.parse(row.kickoffAt))||
         row.kickoffAt.slice(0,4)<String(year)||
         row.kickoffAt.slice(0,4)>String(year+1)||
         row.kickoffAt<String(year)+'-07-01'||
         row.kickoffAt>=String(year+1)+'-07-01')fail();
      kickoffKnown++;
    }
  }
  const meta=doc.meta;
  const truncated=Boolean(meta.pagination?.next_cursor||
    meta.pagination?.has_more===true||meta.pagination?.hasNextPage===true);
  const unavailable=!isEmpty(meta.unavailable);
  const windowed=!isEmpty(meta.scope?.window);
  const licenseMetadata=Array.isArray(meta.sources)&&meta.sources.some(s=>
    obj(s)&&typeof s.name==='string'&&s.name.length>0&&s.name.length<=160&&
    typeof s.license==='string'&&s.license.length>0&&s.license.length<=160);
  const state=unavailable?'INCONCLUSIVE_UNAVAILABLE':
    windowed?'INCONCLUSIVE_WINDOW':
    doc.data.length===0?'UNKNOWN_EMPTY_SAMPLE':
    'SAMPLE_PRESENT_UNAPPROVED';
  return Object.freeze({
    season,observedRows:ids.size,observedTeams:teams.size,
    finishedObserved:finished,utcKickoffsObserved:kickoffKnown,
    paginationRestricted:truncated,sourceMetadataPresent:licenseMetadata,
    coverageState:state,fullSeasonVerified:false
  });
}

/** Only the seven development seasons; never inspect 2025/26 sealed labels. */
export function auditSevenSeasonSamples(pages,observedAtUtc){
  if(!Array.isArray(pages)||pages.length!==HISTORICAL_SEASONS.length||
     !observedAt(observedAtUtc))fail();
  const seasons=HISTORICAL_SEASONS.map((season,i)=>checkSeasonPage(pages[i],season));
  return Object.freeze({
    schemaVersion:1,kind:'M2_RPL_SEVEN_SEASON_STARTER_DISCOVERY',
    competition:COMPETITION,observedAtUtc,
    access:'owner_only_starter_sample',
    requestsSent:7,expectedFixturesMaximum:1680,
    developmentSeasons:seasons,
    seasonsWithSamples:seasons.filter(s=>s.observedRows>0).length,
    observedSampleRows:seasons.reduce((n,s)=>n+s.observedRows,0),
    completeSeasonsVerified:0,
    allSevenSeasonsVerified:false,
    historicalCoverageApproved:false,
    trainingApproved:false,holdoutRead:false,
    prospectivePredictionsPublished:0,
    privateRecordsPersisted:false,providerRowsLogged:0
  });
}

function readBounded(file){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>200000)fail();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)fail();
    const pages=[],digests=[];
    for(let i=0;i<HISTORICAL_SEASONS.length;i++){
      const raw=readBounded(join(process.argv[2],String(i+1).padStart(2,'0')+'.json'));
      pages.push(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw)));
      digests.push(createHash('sha256').update(raw).digest('hex'));
    }
    const report=auditSevenSeasonSamples(pages,process.argv[3]);
    console.log(JSON.stringify({...report,
      sampledResponsesSha256:createHash('sha256').update(JSON.stringify(digests)).digest('hex')}));
  }catch{
    console.error('M2 RPL historical discovery inconclusive; source rows withheld');
    process.exitCode=2;
  }
}
