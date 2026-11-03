// One-shot free Starter RPL 2026/27 team-filter audit. No provider row output.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizeOpenFootRpl} from './m2-openfoot-rpl-diagnostic.mjs';

const COMP='comp_premier_league_rus',SEASON='2026/27',TEAM=/^[A-Za-z0-9_-]{3,96}$/;
const STATES=['scheduled','live','finished','postponed','cancelled','unknown'];
const refuse=()=>{throw Error('OpenFoot team audit refused untrusted data');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const seasonDate=x=>typeof x==='string'&&/^202[67]-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x)&&
  !Number.isNaN(Date.parse(x))&&new Date(x).toISOString().startsWith(x.slice(0,10)+'T')&&
  x>='2026-07-01T00:00:00Z'&&x<'2027-07-01T00:00:00Z';

function decode(doc,team){
  if(!obj(doc)||!Array.isArray(doc.data)||doc.data.length>30||!obj(doc.meta)||
     !obj(doc.meta.access)||doc.meta.access.authenticated!==true||
     doc.meta.access.plan!=='starter'||doc.meta.count!==doc.data.length)refuse();
  const meta=doc.meta;
  const unavailable=meta.unavailable!==undefined&&meta.unavailable!==null&&
    !(Array.isArray(meta.unavailable)&&meta.unavailable.length===0)&&
    !(obj(meta.unavailable)&&Object.keys(meta.unavailable).length===0);
  const scoped=meta.scope?.window!==undefined&&meta.scope.window!==null;
  const cursor=Boolean(meta.pagination?.next_cursor||meta.pagination?.has_more===true||
    meta.pagination?.hasNextPage===true);
  const licence=Array.isArray(meta.sources)&&meta.sources.some(x=>
    obj(x)&&typeof x.name==='string'&&x.name.length>0&&x.name.length<160&&
    typeof x.license==='string'&&x.license.length>0&&x.license.length<160);
  const once=new Set();
  for(const row of doc.data){
    if(!obj(row)||typeof row.id!=='string'||row.id.length<2||row.id.length>160||
      once.has(row.id)||row.competitionId!==COMP||
      (row.season!==undefined&&row.season!==SEASON)||
      !obj(row.homeTeam)||!obj(row.awayTeam)||
      !TEAM.test(row.homeTeam.id)||!TEAM.test(row.awayTeam.id)||
      row.homeTeam.id===row.awayTeam.id||!STATES.includes(row.status)||
      (row.kickoffAt!==null&&row.kickoffAt!==undefined&&!seasonDate(row.kickoffAt))||
      (row.homeTeam.id!==team&&row.awayTeam.id!==team))refuse();
    once.add(row.id);
  }
  return {rows:doc.data,unavailable,scoped,cursor,licence};
}

/** Derive IDs from a validated free-season sample, never external user input. */
export function discoverTeams(seed,observed){
  const summary=summarizeOpenFootRpl(seed,observed,'starter');
  if(summary.starterTierVerified!==true||summary.distinctClubsObserved!==16||
     summary.matchesObserved>50||summary.matchesObserved===0||
     summary.unavailableFlagPresent!==false||summary.scopeWindowLimited!==false)refuse();
  const ids=[...new Set(seed.data.flatMap(x=>[x.homeTeam.id,x.awayTeam.id]))].sort();
  if(ids.length!==16||ids.some(x=>!TEAM.test(x)))refuse();
  return ids;
}

/** Cross-check paired club views and emit numeric evidence only. */
export function auditTeamPages(ids,pages,observed){
  if(!Array.isArray(ids)||ids.length!==16||ids.some(x=>!TEAM.test(x))||
    new Set(ids).size!==16||!Array.isArray(pages)||pages.length!==16)refuse();
  if(typeof observed!=='string'||!/^202[67]-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observed)||
     Number.isNaN(Date.parse(observed)))refuse();
  const matches=new Map(),appearances=new Map(),pairs=new Set();
  const statuses=Object.fromEntries(STATES.map(s=>[s,0]));
  let rawRows=0,licensePages=0,unavailablePages=0,scopedPages=0,pagedPages=0,missingUtc=0;
  for(let i=0;i<16;i++){
    const page=decode(pages[i],ids[i]);
    if(page.licence)licensePages++;
    if(page.unavailable)unavailablePages++;
    if(page.scoped)scopedPages++;
    if(page.cursor)pagedPages++;
    for(const row of page.rows){
      rawRows++;
      const key=row.id;
      const identity=JSON.stringify([
        row.id,row.homeTeam.id,row.awayTeam.id,row.status,row.kickoffAt??null,
        row.homeGoals??null,row.awayGoals??null
      ]);
      const current=matches.get(key);
      if(current){
        if(current.identity!==identity||current.visits>=2)refuse();
        current.visits++;
      }else matches.set(key,{identity,visits:1,row});
    }
  }
  if(rawRows>480||matches.size>240)refuse();
  for(const {visits,row} of matches.values()){
    if(visits!==2)continue;
    for(const id of [row.homeTeam.id,row.awayTeam.id])
      appearances.set(id,(appearances.get(id)??0)+1);
    const pair=JSON.stringify([row.homeTeam.id,row.awayTeam.id]);
    if(pairs.has(pair))refuse();
    pairs.add(pair);
    if(row.kickoffAt==null)missingUtc++;
    statuses[row.status]++;
  }
  const crossConfirmed=[...matches.values()].filter(x=>x.visits===2).length;
  const complete=rawRows===480&&crossConfirmed===240&&matches.size===240&&
    appearances.size===16&&[...appearances.values()].every(n=>n===30)&&
    missingUtc===0&&licensePages===16&&unavailablePages===0&&
    scopedPages===0&&pagedPages===0;
  const state=pagedPages?'INCONCLUSIVE_RESTRICTED_PAGINATION':
    scopedPages?'INCONCLUSIVE_SCOPE_WINDOW':
    unavailablePages?'INCONCLUSIVE_UNAVAILABLE':
    complete?'STRUCTURALLY_COMPLETE_UNAPPROVED':'PARTIAL_UNAPPROVED';
  return Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOT_RPL_2026_27_FREE_STARTER_TEAM_AUDIT',
    source:'OpenFoot API',season:SEASON,competition:COMP,observedAtUtc:observed,
    freeAuthenticatedTeamQueries:16,teamFilters:16,rowsAcrossTeamPages:rawRows,
    uniqueMatchesObserved:matches.size,crossConfirmedUniqueMatches:crossConfirmed,
    clubsWithCrossConfirmedMatches:appearances.size,missingUtcKickoffs:missingUtc,
    statusCounts:statuses,sourceLicenseMetadataPages:licensePages,
    unavailablePages,scopeWindowPages:scopedPages,paginationRestrictedPages:pagedPages,
    coverageState:state,readyForIndependentQualityReview:complete,
    fullRplSeasonApproved:false,productionIngestionApproved:false,
    modelApproved:false,holdoutRead:false,forecastsPublished:0,
    providerRowsLogged:0,privateRowsPersisted:false,
  });
}
function read(file,max=200000){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>max)refuse();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
const parse=buf=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buf));

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const mode=process.argv[2];
    if(mode==='discover'&&process.argv.length===6){
      const seed=parse(read(process.argv[3]));
      const ids=discoverTeams(seed,process.argv[4]);
      writeFileSync(process.argv[5],ids.join('\n')+'\n',{mode:0o600,flag:'wx'});
    }else if(mode==='check'&&process.argv.length===5){
      decode(parse(read(process.argv[3])),process.argv[4]);
    }else if(mode==='aggregate'&&process.argv.length===6){
      const ids=read(process.argv[3],4096).toString('utf8').trim().split('\n');
      const pages=[],fingerprints=[];
      for(let i=0;i<16;i++){
        const raw=read(join(process.argv[4],String(i+1).padStart(2,'0')+'.json'));
        pages.push(parse(raw));
        fingerprints.push(createHash('sha256').update(raw).digest('hex'));
      }
      const result=auditTeamPages(ids,pages,process.argv[5]);
      console.log(JSON.stringify({...result,
        sourceResponsesFingerprintSha256:createHash('sha256')
          .update(JSON.stringify(fingerprints)).digest('hex')}));
    }else refuse();
  }catch{
    console.error('FAIL: OpenFoot team filter research input refused; no provider records emitted');
    process.exitCode=2;
  }
}
