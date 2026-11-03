// Frozen OpenFootball calendar-only research cohort; no timestamps fabricated.
import {createHash} from 'node:crypto';
import {openSync,closeSync,fstatSync,readFileSync,writeFileSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {OPENFOOTBALL_REFERENCE,inspectPinnedOpenFootball2024} from './m2-openfootball-reference.mjs';

export const CALENDAR_PROTOCOL='m2-openfootball-calendar-v1';
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
const team=name=>'S_'+digest('openfootball-2024-club:'+name).slice(0,20).toUpperCase();
const id=(home,away)=>'OF_'+digest('openfootball-2024-match:'+JSON.stringify([home,away])).slice(0,24).toUpperCase();
const fail=reason=>{throw Error('M2 OpenFootball train-only refused: '+reason);};

/** Only the trusted workflow may promote this in-memory representation to a fit. */
export function buildOpenFootballCalendarInput(verified){
  if(!verified||typeof verified!=='object'||verified.aggregate?.kind!==
    'M2_OPENFOOTBALL_PINNED_REFERENCE_DIAGNOSTIC'||
    verified.aggregate.gitBlobSha1!==OPENFOOTBALL_REFERENCE.gitBlobSha1||
    verified.aggregate.sourceRole!=='independent_historical_reference_only'||
    !/^[a-f0-9]{64}$/.test(verified.aggregate.sourceBytesSha256??'')||
    !Array.isArray(verified.fixtures)||verified.fixtures.length!==240)
    fail('unverified source reference');
  const fixtures=verified.fixtures.map(f=>{
    if(typeof f.homeName!=='string'||typeof f.awayName!=='string'||
       !f.homeName.trim()||!f.awayName.trim()||f.homeName===f.awayName||
       f.kickoffAtUtc!==null||f.historicalPrematchVerified!==false||
       f.resultType!=='played')
      fail('invalid calendar-only match identity');
    return {
      matchId:id(f.homeName,f.awayName),sourceCalendarDate:f.calendarDateUtc,
      round:f.round,homeTeamId:team(f.homeName),awayTeamId:team(f.awayName),
      homeGoals:f.homeGoals,awayGoals:f.awayGoals,resultType:'played'
    };
  }).sort((a,b)=>a.sourceCalendarDate.localeCompare(b.sourceCalendarDate)||
    a.matchId.localeCompare(b.matchId));
  const aliases=new Set(fixtures.flatMap(f=>[f.homeTeamId,f.awayTeamId]));
  if(aliases.size!==16||new Set(fixtures.map(f=>f.matchId)).size!==240)
    fail('invalid source team or fixture cardinality');
  return {
    schemaVersion:1,kind:'M2_OPENFOOTBALL_CALENDAR_TRAIN_INPUT',
    protocol:CALENDAR_PROTOCOL,season:'2024/2025',role:'train_baseline',
    sourceLicense:OPENFOOTBALL_REFERENCE.license,
    sourceCommit:OPENFOOTBALL_REFERENCE.repositoryCommit,
    sourceGitBlobSha1:OPENFOOTBALL_REFERENCE.gitBlobSha1,
    sourceBytesSha256:verified.aggregate.sourceBytesSha256,
    historicalPrematchVerified:false,fixtures
  };
}
function readBounded(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>200000)fail('invalid source byte budget');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)fail('usage: PINNED_SOURCE_TXT PRIVATE_OUTPUT_JSON');
    const verified=inspectPinnedOpenFootball2024(readBounded(process.argv[2]));
    const input=buildOpenFootballCalendarInput(verified);
    writeFileSync(process.argv[3],JSON.stringify(input)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
    // No row- or club-level output; Python prints allowlisted aggregates only.
  }catch{
    console.error('FAIL: M2 OpenFootball train-only source refused; no rows emitted');
    process.exitCode=2;
  }
}
