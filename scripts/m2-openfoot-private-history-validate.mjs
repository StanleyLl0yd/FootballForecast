// M2: owner-only, deterministic seven-season RPL private archival contract.
import {createHash} from 'node:crypto';
import {constants,openSync,readFileSync,closeSync,fstatSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {HISTORICAL_SEASONS} from './m2-openfoot-history-audit.mjs';
import {auditSeasonTeamPages,discoverSeasonTeams} from './m2-openfoot-seven-season-full-audit.mjs';

const refuse=()=>{throw Error('M2 private history source verification failed');};
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const patternId=/^[A-Za-z0-9_-]{2,160}$/;
const atUTC=x=>typeof x==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&
  !Number.isNaN(Date.parse(x))&&new Date(x).toISOString()===x.replace('Z','.000Z');
const isScore=x=>Number.isSafeInteger(x)&&x>=0&&x<=20;

function file(path,max=200000){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<=0||stat.size>max)refuse();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
const parse=bytes=>JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes));

/** Return private records ONLY to trusted, protected runner callers. */
export function preparePrivateHistoryArchive(input,codeSha,runId,observedAtUtc){
  if(!Array.isArray(input)||input.length!==7||
     typeof codeSha!=='string'||!/^[a-f0-9]{40}$/.test(codeSha)||
     !Number.isSafeInteger(runId)||runId<1||!atUTC(observedAtUtc))refuse();
  const records=[],rawHashes=[],seasonSnapshots=[];
  for(let i=0;i<7;i++){
    const season=HISTORICAL_SEASONS[i],source=input[i];
    if(source?.season!==season||!Buffer.isBuffer(source.seed)||
       !Array.isArray(source.pages)||source.pages.length!==16||
       source.pages.some(x=>!Buffer.isBuffer(x)))refuse();
    const seed=parse(source.seed);
    const ids=discoverSeasonTeams(seed,season);
    const pages=source.pages.map(parse);
    const review=auditSeasonTeamPages(ids,pages,season);
    if(review.coverageState!=='STRUCTURALLY_COMPLETE_UNAPPROVED'||
       review.crossConfirmed!==240||review.validFinalScores!==240||
       review.utcKickoffs!==240||review.clubs!==16)refuse();
    const hashes=[sha(source.seed),...source.pages.map(sha)];
    rawHashes.push(...hashes);
    const matches=new Map(),homeCounts=new Map(),awayCounts=new Map();
    for(const page of pages)for(const row of page.data){
      if(matches.has(row.id))continue;
      matches.set(row.id,row);
    }
    if(matches.size!==240)refuse();
    for(const row of matches.values()){
      if(row.status!=='finished'||!patternId.test(row.id)||
         !patternId.test(row.homeTeam.id)||!patternId.test(row.awayTeam.id)||
         !isScore(row.score?.home)||!isScore(row.score?.away)||
         typeof row.kickoffAt!=='string'||Number.isNaN(Date.parse(row.kickoffAt)))
        refuse();
      const dt=new Date(row.kickoffAt).toISOString();
      if(!dt.endsWith('.000Z')||Date.parse(dt)>=Date.parse(observedAtUtc))refuse();
      const kickoff=dt.slice(0,19)+'Z';
      homeCounts.set(row.homeTeam.id,(homeCounts.get(row.homeTeam.id)??0)+1);
      awayCounts.set(row.awayTeam.id,(awayCounts.get(row.awayTeam.id)??0)+1);
      const normalized={
        season,source_match_id:row.id,
        home_team_id:row.homeTeam.id,away_team_id:row.awayTeam.id,
        kickoff_at:kickoff,
        home_goals:row.score.home,away_goals:row.score.away
      };
      const digest=sha(Buffer.from(JSON.stringify(normalized)));
      records.push({...normalized,normalized_row_sha256:digest});
    }
    if(homeCounts.size!==16||awayCounts.size!==16||
       [...homeCounts.values()].some(n=>n!==15)||
       [...awayCounts.values()].some(n=>n!==15))refuse();
    const seasonRows=records.filter(r=>r.season===season)
      .sort((a,b)=>a.source_match_id<b.source_match_id?-1:1);
    if(seasonRows.length!==240)refuse();
    const seasonBytes=Buffer.from(seasonRows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    seasonSnapshots.push({season,rows:240,
      sourceResponsesSha256:sha(Buffer.from(JSON.stringify(hashes))),
      normalizedRowsSha256:sha(seasonBytes)});
  }
  records.sort((a,b)=>a.season===b.season?
    (a.source_match_id<b.source_match_id?-1:a.source_match_id>b.source_match_id?1:0):
    a.season<b.season?-1:1);
  if(records.length!==1680)refuse();
  const bytes=Buffer.from(records.map(r=>JSON.stringify(r)).join('\n')+'\n','utf8');
  const manifest=Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOT_PRIVATE_RPL_HISTORY_ARCHIVE',
    sourceId:'openfoot_starter',sourceTermsUrl:'https://openfootapi.com/terms',
    researchState:'SOURCE_ARCHIVE_ONLY_UNAPPROVED',
    codeSha,githubRunId:runId,retrievedAtUtc:observedAtUtc,
    sourceResponsesSha256:sha(Buffer.from(JSON.stringify(rawHashes))),
    normalizedSha256:sha(bytes),seasons:7,matches:1680,
    developmentSeasons:[...HISTORICAL_SEASONS],seasonSnapshots,
    rightsState:'OWNER_PRIVATE_RESEARCH_UNRESOLVED',
    strictPrematchProvenanceVerified:false,modelTrainingApproved:false,
    holdoutRead:false,publicRowsWritten:0
  });
  return {manifest,privateRecords:bytes};
}

function main(){
  try{
    if(process.argv.length!==5)refuse();
    const root=process.argv[2],out=process.argv[3],observed=process.argv[4];
    const codeSha=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID;
    if(!/^\d{1,18}$/.test(run??''))refuse();
    const input=HISTORICAL_SEASONS.map((season,i)=>{
      const dir=join(root,String(i+1).padStart(2,'0'));
      const seed=file(join(dir,'seed.json'));
      const ids=discoverSeasonTeams(parse(seed),season);
      const storedIds=file(join(dir,'ids.txt'),4096).toString('utf8').trim().split('\n');
      if(JSON.stringify(ids)!==JSON.stringify(storedIds))refuse();
      return {season,seed,pages:ids.map((_,j)=>
        file(join(dir,String(j+1).padStart(2,'0')+'.json')))};
    });
    const {manifest,privateRecords}=preparePrivateHistoryArchive(input,codeSha,Number(run),observed);
    writeFileSync(join(out,'history.jsonl'),privateRecords,{mode:0o600,flag:'wx'});
    writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest)+'\n',
      {mode:0o600,flag:'wx'});
    // Only bounded counts and canonical SHA; no match IDs or scores in logs.
    console.log(JSON.stringify({kind:manifest.kind,sourceResponsesSha256:manifest.sourceResponsesSha256,
      normalizedSha256:manifest.normalizedSha256,seasons:7,matches:1680,
      modelTrainingApproved:false,holdoutRead:false}));
  }catch{
    console.error('FAIL: protected historical archive source refused; no rows emitted');
    process.exitCode=2;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
