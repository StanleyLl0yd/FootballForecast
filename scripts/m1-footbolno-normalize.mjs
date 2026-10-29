// M1: bounded offline normalization. No network, database, forecast fitting or raw logging.
// Source: https://footbolno.ru/otkrytye-dannye (CC BY 4.0, attribution required).
import {createHash} from 'node:crypto';
import {readFileSync, lstatSync, writeFileSync} from 'node:fs';
import {isAbsolute, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseBoundedCsv} from '../apps/web/lib/source-preview-core.mjs';

export const SOURCE_URL='https://footbolno.ru/data/league/235-matches.csv';
export const ATTRIBUTION_URL='https://footbolno.ru/otkrytye-dannye';
export const SEASON_ROLES=Object.freeze({
  '2024/2025':'train_baseline',
  '2025/2026':'sealed_holdout',
  '2026/2027':'current'
});
const MAX_BYTES=2_000_000;
const STATES=new Set(['finished','scheduled','live','cancelled','postponed','awarded']);
const REQUIRED=['match_id','league_id','season','status','home_id','away_id',
  'home','away','home_goals','away_goals','date_utc','time_confirmed'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=reason=>{throw new Error('M1 Footbolno dataset refused: '+reason);};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const safeId=value=>typeof value==='string'&&/^[\p{L}\p{N}._:-]{1,100}$/u.test(value);
const score=value=>/^(?:0|[1-9]\d?)$/.test(value)&&Number(value)<=20?Number(value):null;
function utcTimestamp(value){
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    refuse('retrieval time must be explicit UTC ISO-8601');
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==new Date(value).toISOString())
    refuse('invalid retrieval time');
  return ms;
}
function parseUtc(value){
  if(typeof value!=='string')return null;
  const raw=value.trim().replace(' ','T');
  const dayOnly=datePattern.test(raw);
  const timed=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|\+00:00|\+0000)?$/.test(raw);
  if(!dayOnly&&!timed)return null;
  const utc=dayOnly?raw+'T00:00:00Z':/(?:Z|\+00:00|\+0000)$/.test(raw)?
    raw.replace(/\+0000$/,'+00:00'):raw+'Z';
  const epoch=Date.parse(utc);
  if(!Number.isFinite(epoch))return null;
  const iso=new Date(epoch).toISOString();
  // UTC is mandated by the upstream date_utc column, not inferred from local time.
  if(iso.slice(0,10)!==raw.slice(0,10))return null;
  return {day:iso.slice(0,10),timestamp:dayOnly?null:iso,epoch};
}
const stableJson=value=>JSON.stringify(value);
export function normalizeFootbolnoCsv(bytes,retrievedUtc,{expectedFixtures=240}={}){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES)
    refuse('CSV outside 2MB byte budget');
  if(!Number.isInteger(expectedFixtures)||expectedFixtures<1||expectedFixtures>240)
    refuse('invalid fixture-count contract');
  const retrievedAt=utcTimestamp(retrievedUtc);
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{refuse('invalid source UTF-8');}
  const {header,rows,keys}=parseBoundedCsv(text);
  if(REQUIRED.some(column=>!header.includes(column)))refuse('missing mandatory publisher columns');
  const fileSha256=sha(bytes),seasonFiles={},quality={};
  const todayUtc=new Date(retrievedAt).toISOString().slice(0,10);
  for(const [season,role] of Object.entries(SEASON_ROLES)){
    const candidates=rows.filter(r=>r[keys.league_id].trim()==='235'&&
      r[keys.season].trim()===season);
    const ids=new Set(),pairs=new Set(),teams=new Set(),normalized=[];
    const counters={finished:0,scheduled:0,live:0,cancelled:0,postponed:0,awarded:0,
      quarantined:0,invalidDates:0,invalidScores:0,staleScheduled:0,
      futureFinished:0,unconfirmedTimes:0};
    for(const row of candidates){
      const get=column=>row[keys[column]].trim();
      const matchId=get('match_id'),homeId=get('home_id'),awayId=get('away_id');
      if(!safeId(matchId)||!safeId(homeId)||!safeId(awayId)||homeId===awayId)
        refuse('missing or invalid match/team identities');
      if(ids.has(matchId))refuse('duplicate provider match ID');
      ids.add(matchId);
      const ordered=stableJson([homeId,awayId]);
      if(pairs.has(ordered))refuse('duplicate directed fixture');
      pairs.add(ordered);teams.add(homeId);teams.add(awayId);
      const home=get('home'),away=get('away');
      if(!home||!away||home.length>120||away.length>120||
        /[\u0000-\u001f]/.test(home+away))refuse('invalid club display name');
      const status=get('status');
      if(!STATES.has(status))refuse('unrecognized status');
      counters[status]++;
      const flag=get('time_confirmed');
      if(flag!=='0'&&flag!=='1')refuse('invalid time confirmation flag');
      const date=parseUtc(get('date_utc'));
      const [start,end]=season.split('/').map(Number);
      const lower=String(start)+'-07-01',upper=String(end)+'-07-01';
      let reason=null;
      if(!date||date.day<lower||date.day>=upper||
        (flag==='1'&&!date.timestamp)){
        counters.invalidDates++;reason='invalid_date_or_time';
      }
      const homeRaw=get('home_goals'),awayRaw=get('away_goals');
      const homeGoals=score(homeRaw),awayGoals=score(awayRaw);
      if(status==='finished'){
        if(homeGoals===null||awayGoals===null){
          counters.invalidScores++;reason??='invalid_finished_score';
        }
        if(date&&(date.day>todayUtc||(flag==='1'&&date.epoch>retrievedAt))){
          counters.futureFinished++;reason??='future_finished';
        }
      }else if(status==='scheduled'||status==='cancelled'||status==='postponed'){
        if(homeRaw!==''||awayRaw!==''){
          counters.invalidScores++;reason??='unexpected_nonfinal_score';
        }
      }else if(status==='live'&&(homeRaw!==''||awayRaw!=='')&&
        (homeGoals===null||awayGoals===null)){
        counters.invalidScores++;reason??='invalid_live_score';
      }
      if(status==='scheduled'&&date&&
        (flag==='1'?date.epoch<retrievedAt:date.day<todayUtc)){
        counters.staleScheduled++;reason??='stale_scheduled';
      }
      if(status==='awarded'||status==='cancelled'||status==='postponed'||status==='live')
        reason??='non_played_or_unsettled';
      if(flag==='0')counters.unconfirmedTimes++;
      if(reason)counters.quarantined++;
      normalized.push({
        source:'footbolno',sourceMatchId:matchId,competition:'RPL',
        season,role,homeTeamId:homeId,awayTeamId:awayId,
        homeTeam:home,awayTeam:away,
        calendarDateUtc:date?.day??null,
        kickoffUtc:flag==='1'?date?.timestamp??null:null,
        kickoffTimeConfirmed:flag==='1'&&Boolean(date?.timestamp),
        status,homeGoals:status==='finished'?homeGoals:null,
        awayGoals:status==='finished'?awayGoals:null,
        quarantineReason:reason,
        publishedAtUtc:null, // A retrospective CSV is not a historical publication log.
        sourceFileSha256:fileSha256
      });
    }
    normalized.sort((a,b)=>a.sourceMatchId.localeCompare(b.sourceMatchId,'en'));
    const structural=candidates.length===expectedFixtures&&
      ids.size===expectedFixtures&&pairs.size===expectedFixtures&&
      teams.size===16;
    const finishedReady=role==='current'||counters.finished===expectedFixtures;
    const ready=structural&&finishedReady&&counters.quarantined===0;
    quality[season]={
      role,rows:candidates.length,teams:teams.size,directedPairs:pairs.size,
      ...counters,structural,ready
    };
    seasonFiles[season]=normalized.map(stableJson).join('\n')+'\n';
  }
  const snapshotSHA256=Object.fromEntries(Object.entries(seasonFiles)
    .map(([season,content])=>[season,sha(Buffer.from(content))]));
  return {
    manifest:{
      schemaVersion:1,kind:'M1_PRIVATE_RPL_DATASET',
      source:'Footbolno',sourceUrl:SOURCE_URL,license:'CC BY 4.0',
      licenseUrl:ATTRIBUTION_URL,retrievedAtUtc:retrievedUtc,
      sourceFileSha256:fileSha256,snapshotSHA256,quality,
      historicalPrematchPublicationVerified:false,
      strictHistoricalBacktestingAllowed:false,
      modelTrained:false,dbImported:false
    },
    seasonFiles
  };
}
export function writePrivateSnapshot(snapshot,absoluteDirectory){
  if(typeof absoluteDirectory!=='string'||!isAbsolute(absoluteDirectory))
    refuse('absolute private output directory required');
  const stat=lstatSync(absoluteDirectory);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
    refuse('private output directory must have mode 0700');
  for(const [season,content] of Object.entries(snapshot.seasonFiles)){
    const file=join(absoluteDirectory,'rpl-'+season.replace('/','-')+'.jsonl');
    writeFileSync(file,content,{encoding:'utf8',flag:'wx',mode:0o600});
  }
  writeFileSync(join(absoluteDirectory,'manifest.json'),
    JSON.stringify(snapshot.manifest,null,2)+'\n',
    {encoding:'utf8',flag:'wx',mode:0o600});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4&&process.argv.length!==5)
      refuse('usage: node scripts/m1-footbolno-normalize.mjs CSV RETRIEVED_UTC [PRIVATE_0700_DIRECTORY]');
    const bytes=readFileSync(process.argv[2]);
    const snapshot=normalizeFootbolnoCsv(bytes,process.argv[3]);
    if(process.argv[4])writePrivateSnapshot(snapshot,process.argv[4]);
    // Only counts/hashes/license metadata reach CI logs; never raw rows.
    console.log(JSON.stringify(snapshot.manifest,null,2));
    if(Object.values(snapshot.manifest.quality).some(q=>!q.ready))process.exitCode=1;
  }catch{
    console.error('FAIL: Footbolno normalization refused; no raw data emitted');
    process.exitCode=2;
  }
}