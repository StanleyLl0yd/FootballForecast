// Private source team-identity continuity observation. No match/team identifiers in stdout.
import {createHash} from 'node:crypto';
import {constants,closeSync,fstatSync,openSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {auditSevenSeasonSamples,HISTORICAL_SEASONS} from './m2-openfoot-history-audit.mjs';

const PINNED_OVERLAPS=Object.freeze([14,14,14,13,14,13]);
const FIELD_GROUPS=Object.freeze({
  venue:r=>[r.venue,r.stadium],
  city:r=>[r.city,r.venue?.city,r.stadium?.city,r.location?.city],
  pitchSurface:r=>[r.surface,r.pitch?.surface,r.venue?.surface,r.stadium?.surface],
  weather:r=>[r.weather,r.conditions?.weather],
  coaches:r=>[r.coaches,r.homeCoach,r.awayCoach,r.homeTeam?.coach,r.awayTeam?.coach],
  lineups:r=>[r.lineups,r.lineup,r.homeLineup,r.awayLineup],
  players:r=>[r.players,r.playerStats,r.playerStatistics,r.statistics?.players],
  xg:r=>[r.xg,r.expectedGoals,r.homeXg,r.awayXg,r.stats?.xg,r.statistics?.xg],
  shots:r=>[r.shots,r.stats?.shots,r.statistics?.shots],
  bookmakerOdds:r=>[r.odds,r.markets,r.bookmakerOdds,r.betting]
});
const meaningful=x=>x!==null&&x!==undefined&&
  (Array.isArray(x)?x.length>0:
    typeof x==='object'?Object.keys(x).length>0:
    typeof x==='string'?x.trim().length>0:
    typeof x==='number'?Number.isFinite(x):false);

const refuse=()=>{throw Error('RPL identity research inconclusive: refused source shape');};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,160}$/.test(x);
const digest=x=>createHash('sha256').update(x).digest('hex');
const normalizeName=x=>{
  if(typeof x!=='string'||x.length<2||x.length>120||/[\u0000-\u001f\u007f]/.test(x))
    return null;
  const n=x.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
  return n.length>=2?n:null;
};
const readBounded=file=>{
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>200000)refuse();
    return readFileSync(fd);
  }finally{closeSync(fd);}
};

/** Statistical identity evidence only. No durable club alias map is created. */
export function auditSevenSeasonIdentity(pages,observedAtUtc){
  const sample=auditSevenSeasonSamples(pages,observedAtUtc);
  const collections=[],internalIds=[],perSeason=[];
  for(let i=0;i<7;i++){
    const season=HISTORICAL_SEASONS[i],map=new Map(),reverseNames=new Map();
    const doc=pages[i];
    const fields=Object.fromEntries(Object.keys(FIELD_GROUPS).map(k=>[k,0]));
    for(const row of doc.data){
      for(const [group,select] of Object.entries(FIELD_GROUPS)){
        if(select(row).some(meaningful))fields[group]++;
      }
      for(const team of [row.homeTeam,row.awayTeam]){
        if(!id(team.id))refuse();
        const name=normalizeName(team.name);
        const variants=map.get(team.id)??new Set();
        if(name!==null)variants.add(name);
        map.set(team.id,variants);
        if(name!==null){
          const owners=reverseNames.get(name)??new Set();
          owners.add(team.id);
          reverseNames.set(name,owners);
        }
      }
    }
    if(map.size!==16)refuse();
    const missingNameIDs=[...map.values()].filter(names=>names.size===0).length;
    const conflictingNameIDs=[...map.values()].filter(names=>names.size>1).length;
    const nameCollisionCount=[...reverseNames.values()].filter(owners=>owners.size>1).length;
    const identities=[...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([team,names])=>
      [season,team,[...names].sort()]);
    internalIds.push(...identities);
    collections.push(map);
    perSeason.push(Object.freeze({
      season,sourceMatchSample:doc.data.length,observedClubs:map.size,
      firstPageCandidateFieldCounts:fields,
      missingNameIDs,conflictingNameIDs,nameCollisionCount,
      identityNamesComplete:missingNameIDs===0&&conflictingNameIDs===0&&
        nameCollisionCount===0
    }));
  }
  const adjacent=[];
  for(let i=0;i<6;i++){
    const a=collections[i],b=collections[i+1];
    const shared=[...a.keys()].filter(x=>b.has(x));
    let unchanged=0,changed=0,unverified=0;
    for(const k of shared){
      const an=a.get(k),bn=b.get(k);
      if(an.size!==1||bn.size!==1){unverified++;continue;}
      if([...an][0]===[...bn][0])unchanged++;
      else changed++;
    }
    adjacent.push(Object.freeze({
      earlierSeason:HISTORICAL_SEASONS[i],laterSeason:HISTORICAL_SEASONS[i+1],
      sharedProviderIds:shared.length,unchangedDisplayNames:unchanged,
      changedDisplayNames:changed,missingOrAmbiguousNames:unverified,
      matchesPreviouslyObservedPrivateIdOverlap:shared.length===PINNED_OVERLAPS[i],
      mappingAccepted:false
    }));
  }
  const uniqueCount=new Set(internalIds.map(x=>x[1])).size;
  return Object.freeze({
    schemaVersion:1,kind:'M2_RPL_SEVEN_SEASON_TEAM_IDENTITY_SAMPLE',
    observedAtUtc,source:'OpenFoot Starter',seasons:7,requests:7,
    sampleRows:sample.observedSampleRows,
    providerIDsAcrossSevenSeasons:uniqueCount,
    matchesPreviousPrivateUniqueCount:uniqueCount===26,
    seasons:perSeason,consecutiveSeasons:adjacent,
    identityContinuitySha256:digest(JSON.stringify(internalIds)),
    sourceInternalNamesFullyConsistent:perSeason.every(x=>x.identityNamesComplete)&&
      adjacent.every(x=>x.changedDisplayNames===0&&x.missingOrAmbiguousNames===0),
    independentlyCorroboratedClubMapping:false,
    candidateFieldsAreNotVerifiedFullSeasonCoverage:true,
    featureValuesRetained:false,
    modelTrainingApproved:false,holdoutRead:false,
    providerRowsPersisted:false,providerNamesLogged:0,providerIDsLogged:0
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)refuse();
    const bytes=[],pages=[];
    for(let i=0;i<7;i++){
      const raw=readBounded(join(process.argv[2],String(i+1).padStart(2,'0')+'.json'));
      bytes.push(digest(raw));
      pages.push(JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw)));
    }
    const result=auditSevenSeasonIdentity(pages,process.argv[3]);
    console.log(JSON.stringify({...result,
      sourcePagesSha256:digest(JSON.stringify(bytes))}));
  }catch{
    console.error('M2 RPL identity sample INCONCLUSIVE; no source names or IDs emitted');
    process.exitCode=2;
  }
}
