// M2: read-only, exact-revision OpenFootball 2024/25 reference adapter.
// Never replaces the sealed Footbolno study source or creates trainable labels.
import {createHash} from 'node:crypto';
import {readFileSync,openSync,closeSync,fstatSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {auditFootballTxtQuality} from './m0-source-quality.mjs';
import {extractFootballTxtRows} from './m0-fixture-reconcile.mjs';

export const OPENFOOTBALL_REFERENCE=Object.freeze({
  source:'OpenFootball',
  license:'CC0-1.0',
  attribution:'https://github.com/openfootball/europe',
  repositoryCommit:'63df627f3c87ce71708f016522ea236cf74332c3',
  path:'russia/2024-25_ru1.txt',
  gitBlobSha1:'6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
  season:'2024/2025',
  role:'independent_historical_reference_only'
});
const MAX_BYTES=200_000;
const refused=reason=>{throw Error('M2 OpenFootball reference refused: '+reason);};
const pair=(home,away)=>JSON.stringify([home,away]);
const validDate=value=>typeof value==='string'&&/^202[45]-\d{2}-\d{2}$/.test(value)&&
  !Number.isNaN(Date.parse(value+'T00:00:00Z'))&&
  new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value&&
  value>='2024-07-01'&&value<'2025-07-01';

/** Pure structural parsing of retrospective publisher data (NOT model training).
 * Returned row-level records are PRIVATE IN-MEMORY RESEARCH MATERIAL.
 * The data has calendar dates, not independently authenticated kickoff instants.
 * @param {string} source
 */
export function parseOpenFootball2024Reference(source){
  if(typeof source!=='string'||!source.startsWith('= Russia Premier League 2024/25\n')&&
      !source.startsWith('= Russia Premier League 2024/25\r\n')||
      Buffer.byteLength(source,'utf8')>MAX_BYTES)
    refused('invalid RPL season or bounded text');
  const quality=auditFootballTxtQuality(source);
  if(!quality.mechanicalChecksPassed||quality.awardedCount!==0||
     quality.ordinaryScoreRows!==240||quality.roundCount!==30)
    refused('incomplete or anomalous 240-match season');
  const sourceRecords=extractFootballTxtRows(source);
  if(sourceRecords.dateErrors.length!==0||sourceRecords.rows.length!==240)
    refused('unanchored or impossible match dates');
  const seen=new Set(),clubs=new Map(),rounds=new Map();
  const fixtures=[];
  for(const row of sourceRecords.rows){
    const key=pair(row.home,row.away);
    if(seen.has(key)||row.resultType!=='played'||!validDate(row.date)||
       !Number.isSafeInteger(row.round)||row.round<1||row.round>30||
       !Number.isSafeInteger(row.homeGoals)||!Number.isSafeInteger(row.awayGoals)||
       row.homeGoals<0||row.awayGoals<0||row.homeGoals>20||row.awayGoals>20)
      refused('duplicate, awarded, unanchored or unsupported fixture');
    seen.add(key);
    clubs.set(row.home,(clubs.get(row.home)??0)+1);
    clubs.set(row.away,(clubs.get(row.away)??0)+1);
    rounds.set(row.round,(rounds.get(row.round)??0)+1);
    fixtures.push(Object.freeze({
      homeName:row.home,awayName:row.away,
      calendarDateUtc:row.date,
      kickoffAtUtc:null, // The source does not establish an authenticated UTC kickoff.
      round:row.round,homeGoals:row.homeGoals,awayGoals:row.awayGoals,
      resultType:'played',historicalPrematchVerified:false
    }));
  }
  if(clubs.size!==16||[...clubs.values()].some(count=>count!==30)||
     rounds.size!==30||[...rounds.values()].some(count=>count!==8)||
     seen.size!==240)
    refused('incomplete team or round coverage');
  return Object.freeze(fixtures);
}

/** Verify exact source bytes against the pre-reviewed Git blob before parsing.
 * Do not pass the returned private fixtures to logs, browser, or public CI artifacts.
 * This is an independent reference only and CANNOT replace M2's frozen input.
 * @param {Uint8Array} bytes
 */
export function inspectPinnedOpenFootball2024(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES)
    refused('invalid source byte budget');
  const data=Buffer.from(bytes);
  const blob=createHash('sha1').update('blob '+data.byteLength+'\0')
    .update(data).digest('hex');
  if(blob!==OPENFOOTBALL_REFERENCE.gitBlobSha1)
    refused('source bytes do not match the immutable reviewed Git blob');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(data);}
  catch{refused('source must be UTF-8');}
  const fixtures=parseOpenFootball2024Reference(text);
  const outcomes={home:0,draw:0,away:0,homeGoals:0,awayGoals:0};
  for(const f of fixtures){
    outcomes.homeGoals+=f.homeGoals;outcomes.awayGoals+=f.awayGoals;
    if(f.homeGoals>f.awayGoals)outcomes.home++;
    else if(f.homeGoals===f.awayGoals)outcomes.draw++;
    else outcomes.away++;
  }
  const aggregate=Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOTBALL_PINNED_REFERENCE_DIAGNOSTIC',
    source:OPENFOOTBALL_REFERENCE.source,
    attribution:OPENFOOTBALL_REFERENCE.attribution,
    license:OPENFOOTBALL_REFERENCE.license,
    season:OPENFOOTBALL_REFERENCE.season,
    repositoryCommit:OPENFOOTBALL_REFERENCE.repositoryCommit,
    sourcePath:OPENFOOTBALL_REFERENCE.path,
    gitBlobSha1:blob,
    sourceBytesSha256:createHash('sha256').update(data).digest('hex'),
    fixtures:240,clubs:16,rounds:30,awarded:0,
    outcomes,verifiedKickoffInstants:0,
    sourceRole:'independent_historical_reference_only',
    exactSourceVersionVerified:true,
    sourceClaimOfCC0:true,
    originalAuthorityVerified:false,
    independentUpstreamVerified:false,
    historicalPrematchVerified:false,
    canReplaceFrozenFootbolnoStudyInput:false,
    trainableOrPublishable:false,
    holdoutRead:false
  });
  return {aggregate,fixtures};
}

function readBounded(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)
      refused('expected bounded regular source file');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)refused('usage: node scripts/m2-openfootball-reference.mjs PINNED_LOCAL_TXT');
    // Diagnostic only: NEVER print the private fixture rows.
    console.log(JSON.stringify(inspectPinnedOpenFootball2024(readBounded(process.argv[2])).aggregate));
  }catch{
    console.error('FAIL: M2 pinned OpenFootball reference refused; no match rows emitted');
    process.exitCode=2;
  }
}
