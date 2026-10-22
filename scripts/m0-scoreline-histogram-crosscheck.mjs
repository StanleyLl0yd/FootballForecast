// M0: compare published, lawfully attributed aggregate scoreline frequencies.
// NO raw match-row output, training, backend ingestion, automatic provider polling
// or claim of authenticated match-level/chronological source accuracy.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseBoundedCsv,summarizeFootbolnoRplCsv} from '../apps/web/lib/source-preview-core.mjs';
import {auditFootballTxt} from './m0-fixture-structure.mjs';

const SEASON='2024/2025';
const SOURCE_BANNER='= Russia Premier League 2024/25';
const normalizeHistogram=h=>Object.fromEntries(Object.entries(h)
  .sort(([a],[b])=>a.localeCompare(b)));

export function comparePublishedRplScorelines(csv,footballTxt){
  if(typeof csv!=='string'||typeof footballTxt!=='string'||
    !footballTxt.startsWith(SOURCE_BANNER))throw new Error('Expected published 2024/25 sources');
  const csvAudit=summarizeFootbolnoRplCsv(csv,'2026-10-22T00:00:00Z');
  const selected=csvAudit.seasonSummaries.find(s=>s.season===SEASON);
  if(!selected?.structuralCandidate||selected.finished!==240)
    throw new Error('Publisher candidate season is not structurally complete');
  const ofAudit=auditFootballTxt(footballTxt);
  if(!ofAudit.ok||ofAudit.matchRows!==240||ofAudit.parsedRows!==240)
    throw new Error('Pinned CC0 reference does not form a full 240-match season');
  // 2024/25 has no awarded games in the pinned reference. Keep awarded
  // scores out of an on-field research comparison until separately classified.
  if(/\[awarded\]/i.test(footballTxt))
    throw new Error('Awarded result must be classified separately');
  const {rows,keys}=parseBoundedCsv(csv);
  const counts=Object.create(null);
  let matched=0;
  for(const row of rows){
    if(row[keys.league_id].trim()!=='235'||row[keys.season].trim()!==SEASON)continue;
    if(row[keys.status].trim()!=='finished')
      throw new Error('Incomplete publisher reference season');
    const home=row[keys.home_goals].trim(),away=row[keys.away_goals].trim();
    if(!/^(?:0|[1-9]\d?)$/.test(home)||!(/^(?:0|[1-9]\d?)$/.test(away))||
      Number(home)>20||Number(away)>20)
      throw new Error('Invalid scoreline in publisher data');
    const key=Number(home)+'-'+Number(away);
    counts[key]=(counts[key]||0)+1;
    matched++;
  }
  if(matched!==240)throw new Error('Expected exactly 240 finished publisher fixtures');
  const original=normalizeHistogram(counts);
  const reference=normalizeHistogram(ofAudit.scorelineHistogram);
  const differences=Object.keys({...original,...reference}).map(key=>({
    scoreline:key,publisher:original[key]||0,cc0Reference:reference[key]||0,
  })).filter(d=>d.publisher!==d.cc0Reference)
    .sort((a,b)=>Math.abs(b.publisher-b.cc0Reference)-
      Math.abs(a.publisher-a.cc0Reference)||a.scoreline.localeCompare(b.scoreline));
  const sumGoals=h=>Object.entries(h).reduce((totals,[key,count])=>{
    const [home,away]=key.split('-').map(Number);
    return {home:totals.home+home*count,away:totals.away+away*count};
  },{home:0,away:0});
  const homeAwayPublisher=sumGoals(original),homeAwayReference=sumGoals(reference);
  return {
    schemaVersion:1,kind:'M0_LICENSED_SOURCE_AGGREGATE_RESEARCH',
    season:SEASON,
    sources:[
      {name:'Footbolno',licenseClaim:'CC BY 4.0',url:'https://footbolno.ru/otkrytye-dannye'},
      {name:'OpenFootball',licenseClaim:'CC0 1.0',url:'https://github.com/openfootball/europe'}
    ],
    finishedFixtureCounts:{footbolno:matched,openFootball:ofAudit.parsedRows},
    sourceReportedGoals:{footbolno:homeAwayPublisher,openFootball:homeAwayReference},
    equalScorelineFrequencyDistribution:differences.length===0,
    differentScorelineBuckets:differences.length,
    sumAbsoluteBucketDifferences:differences.reduce((n,d)=>
      n+Math.abs(d.publisher-d.cc0Reference),0),
    discrepancies:differences.slice(0,12),
    discrepanciesTruncated:differences.length>12,
    attributionRequired:true,
    matchByMatchAgreementVerified:false,
    originalUpstreamRightsVerified:false,
    strictPrematchSnapshotsVerified:false,
    authorizedForProductionTraining:false,
    modelTrained:false,
    originalRowsPersisted:false
  };
}
function main(){
  if(process.argv.length!==4)throw new Error('Usage: node m0-scoreline-histogram-crosscheck.mjs TEMP_CSV TEMP_CC0_TXT');
  const csvRaw=readFileSync(process.argv[2]);
  const refRaw=readFileSync(process.argv[3]);
  if(csvRaw.length<1||csvRaw.length>2_000_000||
    refRaw.length<1||refRaw.length>200_000)
    throw new Error('Research source byte budget exceeded');
  const evidence=JSON.parse(readFileSync(
    new URL('../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json',import.meta.url)));
  const pinned=evidence.seasons.find(s=>s.season==='2024/25');
  const actualBlob=createHash('sha1')
    .update('blob '+refRaw.length+'\0').update(refRaw).digest('hex');
  if(!pinned||evidence.sourceCommit!=='63df627f3c87ce71708f016522ea236cf74332c3'||
    pinned.gitBlobSHA1!==actualBlob)
    throw new Error('OpenFootball published reference SHA/commit mismatch');
  const csv=new TextDecoder('utf-8',{fatal:true}).decode(csvRaw);
  const txt=new TextDecoder('utf-8',{fatal:true}).decode(refRaw);
  const summary=comparePublishedRplScorelines(csv,txt);
  console.log(JSON.stringify({
    sourceCsvSHA256:createHash('sha256').update(csvRaw).digest('hex'),
    openFootballGitBlob:actualBlob,
    openFootballPinnedCommit:evidence.sourceCommit,
    ...summary
  },null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main()}catch(e){console.error('FAIL: '+e.message);process.exitCode=2}
}
