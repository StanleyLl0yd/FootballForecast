// Historical full-season RPL structural audit. Only owner/free API, no holdout/DB writes.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HISTORICAL_SEASONS} from './m2-openfoot-history-audit.mjs';

const COMP='comp_premier_league_rus',ID=/^[A-Za-z0-9_-]{2,160}$/;
const fail=()=>{throw Error('M2 historical full-season audit refused untrusted input');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const empty=x=>x==null||Array.isArray(x)&&x.length===0||obj(x)&&Object.keys(x).length===0;
function page(doc,season,team=null){
  if(!HISTORICAL_SEASONS.includes(season)||!obj(doc)||!Array.isArray(doc.data)||
    doc.data.length>(team?30:50)||!obj(doc.meta)||
    doc.meta.count!==doc.data.length||!obj(doc.meta.access)||
    doc.meta.access.authenticated!==true||doc.meta.access.plan!=='starter')fail();
  const ids=new Set(),year=Number(season.slice(0,4));
  // The pandemic-delayed 2019/20 RPL season completed on 22 July 2020.
  const latestExclusive=season==='2019/20'?'2020-08-01':String(year+1)+'-07-01';
  for(const r of doc.data){
    if(!obj(r)||!ID.test(r.id)||ids.has(r.id)||r.competitionId!==COMP||
      r.season!==season||!obj(r.homeTeam)||!obj(r.awayTeam)||
      !ID.test(r.homeTeam.id)||!ID.test(r.awayTeam.id)||
      r.homeTeam.id===r.awayTeam.id||
      !['finished','scheduled','live','postponed','cancelled','unknown'].includes(r.status)||
      (team!==null&&r.homeTeam.id!==team&&r.awayTeam.id!==team))fail();
    if(r.kickoffAt!=null){
      if(typeof r.kickoffAt!=='string'||
         !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(r.kickoffAt)||
         Number.isNaN(Date.parse(r.kickoffAt))||
         new Date(r.kickoffAt).toISOString().slice(0,10)!==r.kickoffAt.slice(0,10)||
         r.kickoffAt<String(year)+'-07-01'||
         r.kickoffAt>=latestExclusive)fail();
    }
    ids.add(r.id);
  }
  const m=doc.meta;
  return {rows:doc.data,
    paged:Boolean(m.pagination?.next_cursor||m.pagination?.has_more===true||
      m.pagination?.hasNextPage===true),
    unavailable:!empty(m.unavailable),windowed:!empty(m.scope?.window),
    metadata:Array.isArray(m.sources)&&m.sources.some(s=>obj(s)&&
      typeof s.name==='string'&&s.name.length>0&&s.name.length<=160&&
      typeof s.license==='string'&&s.license.length>0&&s.license.length<=160)};
}
export function discoverSeasonTeams(seed,season){
  const p=page(seed,season);
  if(!p.rows.length||p.unavailable||p.windowed)fail();
  const ids=[...new Set(p.rows.flatMap(r=>[r.homeTeam.id,r.awayTeam.id]))].sort();
  if(ids.length!==16)fail();
  return ids;
}
export function auditSeasonTeamPages(ids,pages,season){
  if(!HISTORICAL_SEASONS.includes(season)||!Array.isArray(ids)||ids.length!==16||
    ids.some(id=>!ID.test(id))||new Set(ids).size!==16||
    !Array.isArray(pages)||pages.length!==16)fail();
  const matches=new Map(),appearances=new Map(),pairs=new Set();
  let raw=0,metadata=0,paged=0,unavailable=0,windowed=0;
  for(let i=0;i<16;i++){
    const p=page(pages[i],season,ids[i]);
    if(p.metadata)metadata++;
    if(p.paged)paged++;
    if(p.unavailable)unavailable++;
    if(p.windowed)windowed++;
    for(const r of p.rows){
      raw++;
      const identity=JSON.stringify([r.id,r.homeTeam.id,r.awayTeam.id,r.status,
        r.kickoffAt??null,r.score?.home??null,r.score?.away??null]);
      const old=matches.get(r.id);
      if(old){
        if(old.identity!==identity||old.visits.has(ids[i]))fail();
        old.visits.add(ids[i]);
      }else matches.set(r.id,{identity,visits:new Set([ids[i]]),row:r});
    }
  }
  if(raw>480||matches.size>240)fail();
  let confirmed=0,finished=0,score=0,utc=0;
  for(const {row:r,visits} of matches.values()){
    if(visits.size!==2)continue;
    if(!visits.has(r.homeTeam.id)||!visits.has(r.awayTeam.id))fail();
    confirmed++;
    const directed=JSON.stringify([r.homeTeam.id,r.awayTeam.id]);
    if(pairs.has(directed))fail();
    pairs.add(directed);
    for(const id of [r.homeTeam.id,r.awayTeam.id])
      appearances.set(id,(appearances.get(id)??0)+1);
    if(r.status==='finished')finished++;
    if(r.kickoffAt!=null)utc++;
    // The actual Starter contract uses nested score.home / score.away.
    if(Number.isSafeInteger(r.score?.home)&&Number.isSafeInteger(r.score?.away)&&
      r.score.home>=0&&r.score.home<=20&&r.score.away>=0&&r.score.away<=20)score++;
  }
  const complete=raw===480&&matches.size===240&&confirmed===240&&
    appearances.size===16&&[...appearances.values()].every(n=>n===30)&&
    finished===240&&score===240&&utc===240&&metadata===16&&
    !paged&&!unavailable&&!windowed;
  const state=paged?'INCONCLUSIVE_RESTRICTED_PAGINATION':
    unavailable?'INCONCLUSIVE_UNAVAILABLE':
    windowed?'INCONCLUSIVE_SCOPE_WINDOW':
    complete?'STRUCTURALLY_COMPLETE_UNAPPROVED':'PARTIAL_UNAPPROVED';
  return Object.freeze({season,coverageState:state,uniqueMatches:matches.size,
    crossConfirmed:confirmed,clubs:appearances.size,finished,validFinalScores:score,
    utcKickoffs:utc,sourceMetadataPages:metadata,paginationRestrictedPages:paged,
    unavailablePages:unavailable,scopeWindowPages:windowed,
    trainingApproved:false,holdoutRead:false});
}
export function auditSevenFullSeasons(summaries,at){
  if(!Array.isArray(summaries)||summaries.length!==7||
    typeof at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(at)||
    Number.isNaN(Date.parse(at))||
    summaries.some((s,i)=>s?.season!==HISTORICAL_SEASONS[i]))fail();
  return Object.freeze({schemaVersion:1,kind:'M2_RPL_SEVEN_SEASON_FULL_STRUCTURE_RESEARCH',
    observedAtUtc:at,discoveryRequests:7,teamFilteredRequests:112,requestsTotal:119,
    seasons:summaries,seasonsStructurallyComplete:summaries.filter(s=>
      s.coverageState==='STRUCTURALLY_COMPLETE_UNAPPROVED').length,
    crossConfirmedMatches:summaries.reduce((n,s)=>n+s.crossConfirmed,0),
    strictPrematchProvenanceVerified:false,newModelTrainingApproved:false,
    holdoutRead:false,providerRowsLogged:0,rawRowsPersisted:false});
}
function read(file,max=200000){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>max)fail();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
const parse=b=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(b));
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const mode=process.argv[2];
    if(mode==='discover'&&process.argv.length===6){
      const ids=discoverSeasonTeams(parse(read(process.argv[3])),process.argv[4]);
      writeFileSync(process.argv[5],ids.join('\n')+'\n',{mode:0o600,flag:'wx'});
    }else if(mode==='check'&&process.argv.length===6){
      page(parse(read(process.argv[3])),process.argv[4],process.argv[5]);
    }else if(mode==='aggregate'&&process.argv.length===5){
      const root=process.argv[3],summaries=[],sha=[];
      for(let i=0;i<7;i++){
        const dir=join(root,String(i+1).padStart(2,'0'));
        const seed=read(join(dir,'seed.json'));sha.push(createHash('sha256').update(seed).digest('hex'));
        const season=HISTORICAL_SEASONS[i];
        const ids=discoverSeasonTeams(parse(seed),season);
        const saved=read(join(dir,'ids.txt'),4096).toString('utf8').trim().split('\n');
        if(JSON.stringify(ids)!==JSON.stringify(saved))fail();
        const pages=[];
        for(let j=0;j<16;j++){
          const raw=read(join(dir,String(j+1).padStart(2,'0')+'.json'));
          sha.push(createHash('sha256').update(raw).digest('hex'));
          pages.push(parse(raw));
        }
        summaries.push(auditSeasonTeamPages(ids,pages,season));
      }
      console.log(JSON.stringify({...auditSevenFullSeasons(summaries,process.argv[4]),
        responseHashesSha256:createHash('sha256').update(JSON.stringify(sha)).digest('hex')}));
    }else fail();
  }catch{
    console.error('M2 historical full coverage inconclusive; no provider rows emitted');
    process.exitCode=2;
  }
}
