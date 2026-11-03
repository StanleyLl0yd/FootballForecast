// Private single-run source normalizer. NEVER print or upload normalized rows.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HISTORICAL_SEASONS} from './m2-openfoot-history-audit.mjs';
import {discoverSeasonTeams,auditSeasonTeamPages} from './m2-openfoot-seven-season-full-audit.mjs';

const refused=()=>{throw Error('M2 private RPL history normalization refused untrusted input');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>{
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>200000)refused();
    return readFileSync(fd);
  }finally{closeSync(fd);}
};
const parse=raw=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw));
const utc=t=>typeof t==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(t)&&
  !Number.isNaN(Date.parse(t))&&new Date(t).toISOString()===t.replace('Z','.000Z');

/** Independently verified fixtures only; no public logs or arbitrary input seasons. */
export function normalizePrivateSeason(seed,pages,season,pageDigests){
  if(!HISTORICAL_SEASONS.includes(season)||!Array.isArray(pages)||pages.length!==16||
     !Array.isArray(pageDigests)||pageDigests.length!==17||
     pageDigests.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x)))refused();
  const ids=discoverSeasonTeams(seed,season);
  const evidence=auditSeasonTeamPages(ids,pages,season);
  if(evidence.coverageState!=='STRUCTURALLY_COMPLETE_UNAPPROVED'||
     evidence.crossConfirmed!==240||evidence.validFinalScores!==240)refused();
  const matchMap=new Map();
  for(const doc of pages)for(const row of doc.data){
    if(!matchMap.has(row.id))matchMap.set(row.id,row);
  }
  if(matchMap.size!==240)refused();
  const fixtures=[...matchMap.values()].map(r=>({
    awayGoals:r.score.away,
    awayTeamId:r.awayTeam.id,
    homeGoals:r.score.home,
    homeTeamId:r.homeTeam.id,
    kickoffAt:r.kickoffAt,
    sourceMatchId:r.id
  })).sort((a,b)=>a.kickoffAt.localeCompare(b.kickoffAt)||
    a.sourceMatchId.localeCompare(b.sourceMatchId));
  if(fixtures.length!==240)refused();
  return Object.freeze({
    fixtures,normalizedRowsSha256:sha(JSON.stringify(fixtures)),
    season,sourceResponsesSha256:sha(JSON.stringify(pageDigests))
  });
}

export function makePrivateHistoryDocument(seasons,observedAtUtc,codeSha,runId){
  if(!Array.isArray(seasons)||seasons.length!==7||
    seasons.some((s,i)=>s?.season!==HISTORICAL_SEASONS[i])||
    !utc(observedAtUtc)||typeof codeSha!=='string'||
    !/^[a-f0-9]{40}$/.test(codeSha)||
    !Number.isSafeInteger(runId)||runId<=0)refused();
  return Object.freeze({
    codeSha,
    kind:'M2_PRIVATE_RPL_HISTORY_SOURCE_ONLY',
    observedAtUtc,
    researchRole:'development_source_only',
    runId,
    schemaVersion:1,
    seasons,
    source:'OpenFoot Starter'
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==5)refused();
    const [root,observed,outFile]=process.argv.slice(2);
    const runId=Number(process.env.GITHUB_RUN_ID),codeSha=process.env.GITHUB_SHA;
    const seasons=[];
    for(let i=0;i<HISTORICAL_SEASONS.length;i++){
      const dir=join(root,String(i+1).padStart(2,'0')),season=HISTORICAL_SEASONS[i];
      const seedRaw=read(join(dir,'seed.json'));
      const ids=discoverSeasonTeams(parse(seedRaw),season);
      const idsFile=read(join(dir,'ids.txt')).toString('utf8').trim().split('\n');
      if(JSON.stringify(ids)!==JSON.stringify(idsFile))refused();
      const pages=[],hashes=[sha(seedRaw)];
      for(let j=0;j<16;j++){
        const raw=read(join(dir,String(j+1).padStart(2,'0')+'.json'));
        hashes.push(sha(raw));pages.push(parse(raw));
      }
      seasons.push(normalizePrivateSeason(parse(seedRaw),pages,season,hashes));
    }
    const doc=makePrivateHistoryDocument(seasons,observed,codeSha,runId);
    const bytes=Buffer.from(JSON.stringify(doc),'utf8');
    if(bytes.length>800000||bytes.length<100000)refused();
    writeFileSync(outFile,bytes,{mode:0o600,flag:'wx'});
    // Intentionally emit no source records or identifiers.
    console.log('M2_PRIVATE_RPL_HISTORY_NORMALIZED=7_SEASONS_1680_ROWS_PRIVATE');
  }catch{
    console.error('FAIL: M2 private RPL history normalizer refused; no raw rows logged');
    process.exitCode=2;
  }
}
