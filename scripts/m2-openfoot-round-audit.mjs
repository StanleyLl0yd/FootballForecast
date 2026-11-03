// Bounded owner-only free Starter RPL 2026/27 round coverage diagnostic.
// Never output source rows, club IDs, provider names or credentials.
import {createHash} from 'node:crypto';
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const ROUNDS=30;
const COMPETITION='comp_premier_league_rus';
const SEASON='2026/27';
const STATES=['scheduled','live','finished','postponed','cancelled','unknown'];
const fail=()=>{throw Error('M2 OpenFoot round audit refused untrusted response');};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.length>0&&value.length<=160;
const seasonKickoff=value=>typeof value==='string'&&
  /^202[67]-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)&&
  !Number.isNaN(Date.parse(value))&&new Date(value).toISOString().startsWith(value.slice(0,10)+'T')&&
  value>='2026-07-01T00:00:00Z'&&value<'2027-07-01T00:00:00Z';

/** Check exactly 30 explicitly filtered season matchdays, with no approval power. */
export function auditOpenFootRounds(responses,observedAtUtc){
  if(!Array.isArray(responses)||responses.length!==ROUNDS||
     typeof observedAtUtc!=='string'||
     !/^202[67]-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observedAtUtc)||
     Number.isNaN(Date.parse(observedAtUtc))||
     new Date(observedAtUtc).toISOString()!==observedAtUtc.replace('Z','.000Z'))fail();
  const matchIds=new Set(),directedPairs=new Set(),clubs=new Map();
  const outcomes=Object.fromEntries(STATES.map(s=>[s,0]));
  const roundCounts=[],roundClubs=[];
  let rows=0,utc=0,missingUtc=0,unavailable=0,scopeWindows=0,
    sourceMetadataResponses=0,truncatedResponses=0;
  for(let i=0;i<ROUNDS;i++){
    const value=responses[i];
    if(!object(value)||!Array.isArray(value.data)||!object(value.meta)||
       value.data.length>16)fail();
    const meta=value.meta;
    if(!object(meta.access)||meta.access.authenticated!==true||
       meta.access.plan!=='starter'||meta.count!==value.data.length)fail();
    if(meta.pagination?.next_cursor||meta.pagination?.has_more===true||
       meta.pagination?.hasNextPage===true)truncatedResponses++;
    if(meta.scope?.window!==undefined&&meta.scope.window!==null)scopeWindows++;
    if(meta.unavailable!==undefined&&meta.unavailable!==null&&
       !(Array.isArray(meta.unavailable)&&meta.unavailable.length===0)&&
       !(object(meta.unavailable)&&Object.keys(meta.unavailable).length===0))unavailable++;
    if(Array.isArray(meta.sources)&&meta.sources.some(src=>
      object(src)&&text(src.name)&&text(src.license)))sourceMetadataResponses++;
    const participants=new Set();
    for(const row of value.data){
      if(!object(row)||row.competitionId!==COMPETITION||
        (row.season!==undefined&&row.season!==SEASON)||
        !text(row.id)||!object(row.homeTeam)||!object(row.awayTeam)||
        !text(row.homeTeam.id)||!text(row.awayTeam.id)||
        row.homeTeam.id===row.awayTeam.id||!STATES.includes(row.status))fail();
      if(matchIds.has(row.id))fail();
      matchIds.add(row.id);
      const pair=JSON.stringify([row.homeTeam.id,row.awayTeam.id]);
      if(directedPairs.has(pair))fail();
      directedPairs.add(pair);
      for(const team of [row.homeTeam.id,row.awayTeam.id]){
        if(participants.has(team))fail();
        participants.add(team);
        clubs.set(team,(clubs.get(team)??0)+1);
      }
      if(row.kickoffAt===null||row.kickoffAt===undefined)missingUtc++;
      else if(seasonKickoff(row.kickoffAt))utc++;
      else fail();
      outcomes[row.status]++;
      rows++;
    }
    roundCounts.push(value.data.length);
    roundClubs.push(participants.size);
  }
  if(rows>240||clubs.size>16)fail();
  const structurallyComplete=rows===240&&clubs.size===16&&utc===240&&
    roundCounts.every(n=>n===8)&&roundClubs.every(n=>n===16)&&
    [...clubs.values()].every(n=>n===30)&&
    unavailable===0&&scopeWindows===0&&truncatedResponses===0&&
    sourceMetadataResponses===ROUNDS;
  const state=truncatedResponses?'INCONCLUSIVE_RESTRICTED_PAGINATION':
    unavailable?'INCONCLUSIVE_SOURCE_UNAVAILABLE':
    scopeWindows?'INCONCLUSIVE_SCOPE_WINDOW':
    structurallyComplete?'STRUCTURALLY_COMPLETE_UNAPPROVED':'PARTIAL_UNAPPROVED';
  return Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOT_RPL_2026_27_FREE_STARTER_ROUND_AUDIT',
    competition:COMPETITION,season:SEASON,observedAtUtc,
    requestMode:'explicit_documented_round_filter_free_starter',
    requestsSent:ROUNDS,roundsInspected:ROUNDS,
    coverageState:state,matchesObserved:rows,distinctClubsObserved:clubs.size,
    roundsWithEightMatches:roundCounts.filter(n=>n===8).length,
    roundsWithNoMatches:roundCounts.filter(n=>n===0).length,
    roundsWithSixteenClubs:roundClubs.filter(n=>n===16).length,
    declaredUtcKickoffs:utc,missingUtcKickoffs:missingUtc,
    statusCounts:outcomes,sourceMetadataResponses,
    unavailableResponses:unavailable,scopeWindowResponses:scopeWindows,
    paginationRestrictedResponses:truncatedResponses,
    sourceResponsesFingerprintSha256:null,
    readyForIndependentQualityReview:structurallyComplete,
    fullRplSeasonApproved:false,productionIngestionApproved:false,
    trainOnHoldout:false,holdoutRead:false,forecastPublications:0,
    privateRecordsPersisted:false,providerRowsLogged:0,
  });
}

function readBounded(file){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>180000)fail();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)fail();
    const bodies=[],responses=[];
    for(let i=1;i<=ROUNDS;i++){
      const raw=readBounded(join(process.argv[2],String(i).padStart(2,'0')+'.json'));
      bodies.push(createHash('sha256').update(raw).digest('hex'));
      responses.push(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw)));
    }
    const result=auditOpenFootRounds(responses,process.argv[3]);
    console.log(JSON.stringify({...result,
      sourceResponsesFingerprintSha256:createHash('sha256')
        .update(JSON.stringify(bodies)).digest('hex')}));
  }catch{
    console.error('FAIL: OpenFoot bounded round evidence refused; no records emitted');
    process.exitCode=2;
  }
}
