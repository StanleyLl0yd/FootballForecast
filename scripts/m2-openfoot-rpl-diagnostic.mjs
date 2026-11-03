// One-off, demo-only RPL 2026/27 provider diagnostic. No full-feed promotion.
import {createHash} from 'node:crypto';
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const OPENFOOT_RPL=Object.freeze({
  source:'OpenFoot API',competition:'comp_premier_league_rus',
  season:'2026/27',docs:'https://openfootapi.com/docs',
  rights:'https://openfootapi.com/terms',demoOnly:true
});
const MAX_BYTES=1_200_000;
const FAIL=reason=>{throw Error('M2 OpenFoot diagnostic refused: '+reason);};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validText=(s,n=128)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const validDate=value=>typeof value==='string'&&
  /^202[67]-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)&&
  !Number.isNaN(Date.parse(value))&&
  new Date(value).toISOString().startsWith(value.slice(0,10)+'T')&&
  value>='2026-07-01T00:00:00Z'&&value<'2027-07-01T00:00:00Z';
const statuses=['scheduled','live','finished','postponed','cancelled','unknown'];

/** Pure validation of ONE demo response; does not authorize a source. */
export function summarizeOpenFootRpl(value,observedAtUtc,mode='demo'){
  if(mode!=='demo'&&mode!=='starter')FAIL('unsupported research access mode');
  if(!validText(observedAtUtc,20)||!/^202[67]-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observedAtUtc)||
     !Number.isFinite(Date.parse(observedAtUtc))||
     new Date(observedAtUtc).toISOString()!==observedAtUtc.replace('Z','.000Z'))
    FAIL('unverified observation instant');
  if(!isObject(value)||!Array.isArray(value.data)||!isObject(value.meta)||
     value.data.length>240)FAIL('nonconforming bounded fixture envelope');
  const v=value.meta;
  if(v.count!==undefined&&(!Number.isSafeInteger(v.count)||v.count<0||v.count>100000))
    FAIL('invalid provider metadata count');
  const unavailable=v.unavailable!==undefined&&v.unavailable!==null&&
    !(Array.isArray(v.unavailable)&&v.unavailable.length===0)&&
    !(isObject(v.unavailable)&&Object.keys(v.unavailable).length===0);
  const window=v.scope?.window;
  const limitedWindow=window!==undefined&&window!==null;
  if(limitedWindow&&(!isObject(window)||!/^202[67]-\d\d-\d\d$/.test(window.start??'')||
     !/^202[67]-\d\d-\d\d$/.test(window.end??'')))FAIL('untrusted provider scope window');
  const ids=new Set(),directed=new Set(),clubs=new Map();
  const outcomes=Object.fromEntries(statuses.map(s=>[s,0]));
  let withUtcKickoff=0,withoutUtcKickoff=0;
  for(const row of value.data){
    if(!isObject(row)||row.competitionId!==OPENFOOT_RPL.competition||
       (row.season!==undefined&&row.season!==OPENFOOT_RPL.season)||
       !validText(row.id,160)||!isObject(row.homeTeam)||!isObject(row.awayTeam)||
       !validText(row.homeTeam.id,160)||!validText(row.awayTeam.id,160)||
       row.homeTeam.id===row.awayTeam.id||!statuses.includes(row.status))
      FAIL('out-of-competition, ambiguous or invalid fixture');
    if(ids.has(row.id))FAIL('duplicate match identity');
    ids.add(row.id);
    const key=JSON.stringify([row.homeTeam.id,row.awayTeam.id]);
    if(directed.has(key))FAIL('duplicate directed fixture');
    directed.add(key);
    for(const club of [row.homeTeam.id,row.awayTeam.id])
      clubs.set(club,(clubs.get(club)??0)+1);
    if(row.kickoffAt===null||row.kickoffAt===undefined)withoutUtcKickoff++;
    else if(validDate(row.kickoffAt))withUtcKickoff++;
    else FAIL('bad or non-UTC kickoff');
    outcomes[row.status]++;
  }
  // The demo is not an accepted season feed, even at 240 structurally valid records.
  const structurallyComplete=value.data.length===240&&clubs.size===16&&
    [...clubs.values()].every(count=>count===30)&&
    withUtcKickoff===240&&v.count===240&&!limitedWindow&&!unavailable;
  const starterTierVerified=mode==='starter'&&v.access?.authenticated===true&&
    v.access?.plan==='starter';
  const sourceLicenseMetadataPresent=Array.isArray(v.sources)&&v.sources.some(
    src=>isObject(src)&&validText(src.name)&&validText(src.license));
  const state=unavailable?'INCONCLUSIVE_UNAVAILABLE':
    mode==='starter'&&!starterTierVerified?'INCONCLUSIVE_NOT_FREE_STARTER':
    !value.data.length?'INCONCLUSIVE_EMPTY':
    structurallyComplete?'STRUCTURALLY_COMPLETE_UNAPPROVED':'PARTIAL_UNAPPROVED';
  return Object.freeze({
    schemaVersion:1,kind:mode==='starter'?
      'M2_OPENFOOT_RPL_2026_27_FREE_STARTER_DIAGNOSTIC':
      'M2_OPENFOOT_RPL_2026_27_DEMO_DIAGNOSTIC',
    source:OPENFOOT_RPL.source,competition:OPENFOOT_RPL.competition,
    season:OPENFOOT_RPL.season,observedAtUtc,coverageState:state,
    matchesObserved:value.data.length,declaredMetaCount:v.count??null,
    distinctClubsObserved:clubs.size,withUtcKickoff,withoutUtcKickoff,
    statusCounts:outcomes,scopeWindowLimited:limitedWindow,
    unavailableFlagPresent:unavailable,
    sourceLicenseMetadataPresent,starterTierVerified,
    readyForIndependentQualityReview:mode==='starter'&&
      starterTierVerified&&structurallyComplete&&sourceLicenseMetadataPresent,
    dataRetrievalMode:mode==='starter'?
      'single_owner_authenticated_free_starter_request':
      'single_public_documentation_demo_only',
    fullRplSeasonApproved:false,perMatchHistoricalAsOfVerified:false,
    independentUpstreamAuthorityVerified:false,productionIngestionApproved:false,
    trainingOnOpenFootApproved:false,holdoutRead:false,forecastsPublished:0,
    providerRowsLogged:0
  });
}
function readBounded(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)
      FAIL('invalid bounded regular file');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4&&process.argv.length!==5)
      FAIL('expected local provider JSON, UTC observation instant and optional mode');
    const bytes=readBounded(process.argv[2]);
    const parsed=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));
    const result=summarizeOpenFootRpl(parsed,process.argv[3],process.argv[4]??'demo');
    // Aggregate/hash only: never print provider match/club identities or raw rows.
    console.log(JSON.stringify({
      ...result,sourceResponseSha256:createHash('sha256').update(bytes).digest('hex')
    }));
  }catch{
    console.error('FAIL: OpenFoot demo response refused; no provider records printed');
    process.exitCode=2;
  }
}
