// M1: independently score-check 2024/25 before any private Supabase import.
// Accept UTC-date disagreement for quarantine review; never infer historical as-of access.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

function refuse(message){throw new Error('M1 OpenFootball source comparison refused: '+message);}
export function verifyHistoricalPublisherScoreConsistency(report){
  if(!report||typeof report!=='object'||Array.isArray(report)||
    report.season!=='2024/2025'||report.kind!=='M0_SOURCE_REPORTED_MATCH_BY_MATCH_CROSSCHECK'||
    report.compared!==240||report.referenceCount!==240||
    report.matchedDirectedFixtures!==240||
    report.missingFromPublisher!==0||report.missingFromOpenFootball!==0||
    report.dateSourceErrors!==0||report.structuralSourceErrors!==0||
    report.referenceAwardedGames!==0)
    refuse('incomplete or structurally invalid 2024/25 comparator');
  const differences=report.differingFields;
  if(!differences||!Number.isInteger(differences.homeGoals)||
    !Number.isInteger(differences.awayGoals)||
    !Number.isInteger(differences.resultType)||
    !Number.isInteger(differences.date)||
    Object.values(differences).some(x=>x<0||x>240))
    refuse('missing or malformed match-level field counts');
  if(differences.homeGoals>0||differences.awayGoals>0||differences.resultType>0)
    refuse('unresolved completed-score or match-type conflict');
  return {
    kind:'M1_2024_25_CROSS_SOURCE_SCORE_GATE',
    compared:240,matchedDirectedFixtures:240,
    scoreAndTypeConsistencyPass:true,
    dateConflictsForSeparateReview:differences.date,
    independentOriginalAuthorityVerified:false,
    originalPrematchPublicationTimeVerified:false,
    holdoutEvaluated:false,modelTrained:false,
    sources:[
      {name:'Footbolno',attribution:'https://footbolno.ru/otkrytye-dannye'},
      {name:'OpenFootball',attribution:'https://github.com/openfootball/europe'}
    ]
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)refuse('expected aggregate-only comparison JSON');
    const bytes=readFileSync(process.argv[2]);
    if(bytes.length===0||bytes.length>20000)refuse('aggregate report size exceeded');
    const evidence=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    console.log(JSON.stringify(verifyHistoricalPublisherScoreConsistency(evidence),null,2));
  }catch{
    console.error('FAIL: OpenFootball score gate refused; no source rows printed');
    process.exitCode=2;
  }
}
