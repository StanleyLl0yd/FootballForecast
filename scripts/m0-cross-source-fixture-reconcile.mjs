// Research-only, ephemeral row-level reconciliation of two published $0 RPL
// sources. Input rows are processed locally and NEVER emitted in any report.
// No HTTP, storage, model fit, API writes, rights approval, or time-travel claims.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseBoundedCsv} from '../apps/web/lib/source-preview-core.mjs';
import {reconcileFootballTxt} from './m0-fixture-reconcile.mjs';

const season='2024/2025';
const MAX_CSV_BYTES=2_000_000,MAX_TXT_BYTES=200_000;
const normalize=value=>value.normalize('NFKC').toLowerCase()
  .replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
  .replace(/^(?:fc|fk|фк) /u,'').replace(/\s+/gu,' ');
const teams=[
  ['Lokomotiv Moskva',['локомотив','локомотив москва','локомотив московский','lokomotiv moscow','lokomotiv moskva']],
  ['Krylia Sovetov',['крылья советов','крылья советов самара','krylya sovetov','krylia sovetov samara','krylya sovetov samara']],
  ['FK Rostov',['ростов','ростов на дону','rostov','rostov on don']],
  ['Dinamo Moskva',['динамо москва','динамо московское','динамо москвы','dynamo moscow','dinamo moscow','dynamo moskva']],
  ['FK Orenburg',['оренбург','orenburg','fc orenburg','gazovik orenburg']],
  ['Akhmat Grozny',['ахмат','ахмат грозный','akhmat','akhmat grozny','terek grozny']],
  ['FK Khimki',['химки','khimki']],
  ['FK Dinamo Makhachkala',['динамо махачкала','динамо мх','динамо махачкалинское','dinamo makhachkala','dynamo makhachkala','dynamo m h']],
  ['FK Nizhny Novgorod',['нижний новгород','пари нн','пари нижний новгород','нн','pari nn','pari nizhny novgorod','nizhny novgorod','fc pari nn']],
  ['Rubin Kazan',['рубин','рубин казань','rubin','rubin kazan']],
  ['CSKA Moskva',['цска','цска москва','cska','cska moscow','cska moskva']],
  ['Spartak Moskva',['спартак','спартак москва','spartak','spartak moscow','spartak moskva']],
  ['Fakel Voronezh',['факел','факел воронеж','fakel','fakel voronezh']],
  ['FK Krasnodar',['краснодар','krasnodar']],
  ['Zenit St. Petersburg',['зенит','зенит санкт петербург','зенит спб','zenit','zenit st petersburg','zenit saint petersburg','zenit st peterburg']],
  ['Akron Tolyatti',['акрон','акрон тольятти','akron','akron tolyatti','akron togliatti']]
];
const aliases=new Map();
for(const [canonical,names] of teams){
  for(const name of [canonical,...names]){
    const key=normalize(name);
    if(aliases.has(key)&&aliases.get(key)!==canonical)
      throw new Error('Conflicting club identity alias');
    aliases.set(key,canonical);
  }
}
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const dateOnly=value=>{
  const m=value.match(/^(20\d{2}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}.*)?$/);
  if(!m)return null;
  const epoch=Date.parse(m[1]+'T00:00:00Z');
  return Number.isFinite(epoch)&&new Date(epoch).toISOString().slice(0,10)===m[1]?m[1]:null;
};
function fail(reason){throw new Error('RPL 2024/25 fixture comparison refused: '+reason)}
export function reconcilePublishedRplFixtures(csv,footballTxt){
  if(typeof csv!=='string'||typeof footballTxt!=='string'||
    !footballTxt.startsWith('= Russia Premier League 2024/25'))fail('invalid season/source text');
  const {header,rows,keys}=parseBoundedCsv(csv);
  if(['home','away','date_utc'].some(k=>!header.includes(k)))
    fail('source fields missing');
  const refs=[],seenMatchIds=new Set(),seenDirected=new Set(),seenClubs=new Set();
  let unmappedRows=0,invalidRows=0,duplicates=0;
  for(const values of rows){
    const col=k=>values[keys[k]].trim();
    if(col('league_id')!=='235'||col('season')!==season)continue;
    const h=aliases.get(normalize(col('home')));
    const a=aliases.get(normalize(col('away')));
    if(!h||!a){unmappedRows++;continue}
    const date=dateOnly(col('date_utc'));
    const hg=col('home_goals'),ag=col('away_goals');
    if(!date||col('status')!=='finished'||!(/^\d{1,2}$/.test(hg))||
      !(/^\d{1,2}$/.test(ag))||Number(hg)>20||Number(ag)>20||
      h===a||!col('match_id')||!col('home_id')||!col('away_id')){
      invalidRows++;continue;
    }
    const pair=JSON.stringify([h,a]);
    if(seenMatchIds.has(col('match_id'))||seenDirected.has(pair)){
      duplicates++;continue;
    }
    seenMatchIds.add(col('match_id'));seenDirected.add(pair);
    seenClubs.add(h);seenClubs.add(a);
    refs.push({home:h,away:a,homeGoals:Number(hg),awayGoals:Number(ag),
      resultType:'played',date});
  }
  const rejected={unmappedRows,invalidRows,duplicateRows:duplicates};
  if(Object.values(rejected).some(n=>n>0)||refs.length!==240||seenClubs.size!==16||
    seenDirected.size!==240)fail('team-name mapping or completed 240-fixture identity is incomplete; no rows emitted');
  // The pre-existing offline checker authenticates the expected textual date
  // context, team directions, score, awarded annotation and complete round robin.
  // Only its AGGREGATED diagnostics are released from this wrapper.
  const results=reconcileFootballTxt(footballTxt,refs.map(v=>JSON.stringify(v)).join('\n'));
  const differingFields={date:0,homeGoals:0,awayGoals:0,resultType:0};
  for(const mismatch of results.mismatches)
    for(const field of mismatch.fields)differingFields[field]++;
  return {
    schemaVersion:1,season,kind:'M0_SOURCE_REPORTED_MATCH_BY_MATCH_CROSSCHECK',
    sources:[
      {name:'Footbolno',licenseClaim:'CC BY 4.0',url:'https://footbolno.ru/otkrytye-dannye'},
      {name:'OpenFootball',licenseClaim:'CC0 1.0',url:'https://github.com/openfootball/europe'}
    ],
    compared:results.primaryCount,referenceCount:results.referenceCount,
    matchedDirectedFixtures:results.primaryCount-results.missingFromReference.length,
    missingFromPublisher:results.missingFromPrimary.length,
    missingFromOpenFootball:results.missingFromReference.length,
    dateSourceErrors:results.dateErrors.length,
    structuralSourceErrors:results.referenceErrors.length,
    differingFields,
    mismatchedFixtures:results.mismatches.length,
    observedPublisherAndOpenFootballAgreement:results.comparisonPassed,
    referenceAwardedGames:results.awardedCount,
    researchOnly:true,officialMatchTruthVerified:false,
    independentOriginalUpstreamProvenanceVerified:false,
    historicalPrematchPublishedAtVerified:false,
    authorizedProductionTraining:false,modelTrained:false,
    rawRecordsPersisted:false
  };
}
function main(){
  if(process.argv.length!==4)fail('expected two disposable input files');
  const csv=readFileSync(process.argv[2]),txt=readFileSync(process.argv[3]);
  if(csv.byteLength===0||csv.byteLength>MAX_CSV_BYTES||
     txt.byteLength===0||txt.byteLength>MAX_TXT_BYTES)fail('source byte budgets exceeded');
  const evidence=JSON.parse(readFileSync(
    new URL('../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json',import.meta.url),'utf8'));
  const pinned=evidence.seasons.find(s=>s.season==='2024/25');
  const gitBlob=createHash('sha1').update('blob '+txt.length+'\0')
    .update(txt).digest('hex');
  if(evidence.sourceCommit!=='63df627f3c87ce71708f016522ea236cf74332c3'||
    pinned?.gitBlobSHA1!==gitBlob)fail('CC0 file is not the pinned reference');
  const utf8=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  console.log(JSON.stringify({
    footbolnoCsvSHA256:sha(csv),openFootballGitBlob:gitBlob,
    ...reconcilePublishedRplFixtures(utf8(csv),utf8(txt))
  },null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main()}catch{console.error('FAIL: independent RPL fixture verification refused; no raw data logged');process.exitCode=2}
}
