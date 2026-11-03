// One public OpenFoot competition-catalog request: RPL source rights metadata only.
// Pure inspection; no fixture/club records, credentials, or authorization decisions.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const RPL='comp_premier_league_rus';
const INVALID=()=>{throw Error('OpenFoot RPL source catalog refused untrusted response');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const safe=(x,max=128)=>typeof x==='string'&&x.length>0&&x.length<=max&&
  /^[A-Za-z0-9 _.,:+()/&'-]+$/.test(x);
const sourceUrl=value=>{
  if(typeof value!=='string'||value.length>256)return INVALID();
  let url;try{url=new URL(value);}catch{return INVALID();}
  if(url.protocol!=='https:'||url.username||url.password||url.search||
     url.hash||url.port||url.hostname==='localhost'||!url.hostname.includes('.'))
    return INVALID();
  return url.href;
};
const atUTC=t=>typeof t==='string'&&
  /^202[67]-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(t)&&
  !Number.isNaN(Date.parse(t))&&
  new Date(t).toISOString()===t.replace('Z','.000Z');

export function inspectOpenFootRplCatalog(value,observedAtUtc){
  if(!atUTC(observedAtUtc)||!obj(value)||!Array.isArray(value.data)||
     value.data.length>500||!obj(value.meta))INVALID();
  const matches=value.data.filter(x=>obj(x)&&x.id===RPL);
  if(matches.length!==1)INVALID();
  const item=matches[0],s=item.source;
  if(!obj(s)||!safe(s.name)||!safe(s.license)||
     !['current','archive','unavailable'].includes(s.mode)||
     !Array.isArray(item.availableSeasons)||item.availableSeasons.length>100||
     item.availableSeasons.some(x=>!safe(x,16))||
     typeof item.currentSeason!=='string'||!safe(item.currentSeason,16))
    INVALID();
  const url=sourceUrl(s.url);
  return Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOT_RPL_2026_27_CATALOG_SOURCE_PROVENANCE',
    observedAtUtc,competition:RPL,
    sourceName:s.name,sourceLicenseClaim:s.license,
    sourceUrl:url,sourceMode:s.mode,
    currentSeason:item.currentSeason,
    season2026_27Listed:item.availableSeasons.includes('2026/27'),
    catalogFixturesFlag:item.coverage?.fixtures===true,
    researchInterpretation:s.mode==='unavailable'?
      'SOURCE_CATALOG_INCONSISTENT_WITH_OBSERVED_FIXTURES':
      /unlicensed/i.test(s.license)?
        'UNLICENSED_UPSTREAM_NOT_APPROVED_FOR_PRODUCTION':
        'CATALOG_METADATA_REVIEW_REQUIRED',
    upstreamProductionReuseQualified:false,
    publisherPermissionIndependentlyVerified:false,
    originalUpstreamRightsIndependentlyVerified:false,
    matchResultsCrossChecked:false,
    productionIngestionApproved:false,holdoutRead:false,
    modelApproved:false,forecastsPublished:0,providerMatchRowsLogged:0
  });
}
function readBounded(file){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>1250000)INVALID();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)INVALID();
    const bytes=readBounded(process.argv[2]);
    const parsed=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));
    const report=inspectOpenFootRplCatalog(parsed,process.argv[3]);
    console.log(JSON.stringify({...report,
      catalogResponseSha256:createHash('sha256').update(bytes).digest('hex')}));
  }catch{
    console.error('FAIL: OpenFoot catalog source metadata inconclusive; no records emitted');
    process.exitCode=2;
  }
}
