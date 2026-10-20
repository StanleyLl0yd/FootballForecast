// M0 read-only quality diagnostics for locally supplied Football.TXT.
// No network access, source approval, ingestion, training or time-travel claims.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {auditFootballTxt} from './m0-fixture-structure.mjs';

const fixturePattern=/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s{2,}v\s+(.+?)\s{2,}(\d+)-(\d+)(.*)$/;
const roundPattern=/^\s*▪\s*Matchday\s+(\d+)\s*$/;

export function auditFootballTxtQuality(source,{expectedTeams=16,expectedMatches=240}={}) {
  const structure=auditFootballTxt(source,{expectedTeams,expectedMatches});
  const expectedRounds=2*(expectedTeams-1);
  const fixturesPerRound=expectedTeams/2;
  const rounds=[];
  const awarded=[],unknownAnnotations=[],halfTimeContradictions=[],unassignedFixtures=[];
  // Source-reported scores for administrative awards affect competition tables,
  // but MUST NOT enter observed on-field scoring-strength estimates.
  const emptyTotals=()=>({matches:0,homeWins:0,draws:0,awayWins:0,homeGoals:0,awayGoals:0});
  const playedScoreTotals=emptyTotals(),awardedScoreTotals=emptyTotals();
  const record=(target,homeGoals,awayGoals)=>{
    target.matches++;
    target.homeGoals+=homeGoals;
    target.awayGoals+=awayGoals;
    if(homeGoals>awayGoals)target.homeWins++;
    else if(homeGoals===awayGoals)target.draws++;
    else target.awayWins++;
  };
  let currentRound=null;
  source.split(/\r?\n/).forEach((line,index)=>{
    const lineNumber=index+1;
    const round=line.match(roundPattern);
    if(round){
      currentRound={number:Number(round[1]),line:lineNumber,fixtures:0};
      rounds.push(currentRound);
      return;
    }
    if(!/\s+v\s+/.test(line))return;
    if(currentRound===null)unassignedFixtures.push(lineNumber);
    else currentRound.fixtures++;
    const match=line.match(fixturePattern);
    if(!match)return; // Already reported by auditFootballTxt().
    const [,homeRaw,awayRaw,homeGoalsRaw,awayGoalsRaw,tailRaw]=match;
    let tail=tailRaw.trim();
    const halfTime=tail.match(/^\((\d+)-(\d+)\)(?=\s|$)/);
    if(halfTime){
      if(Number(halfTime[1])>Number(homeGoalsRaw)||Number(halfTime[2])>Number(awayGoalsRaw))
        halfTimeContradictions.push(lineNumber);
      tail=tail.slice(halfTime[0].length).trim();
    }
    if(tail==='[awarded]'){
      awarded.push({line:lineNumber,home:homeRaw.trim(),away:awayRaw.trim(),score:`${homeGoalsRaw}-${awayGoalsRaw}`});
      record(awardedScoreTotals,Number(homeGoalsRaw),Number(awayGoalsRaw));
    } else if(tail){
      unknownAnnotations.push({line:lineNumber,annotation:tail});
    } else {
      record(playedScoreTotals,Number(homeGoalsRaw),Number(awayGoalsRaw));
    }
  });
  const roundViolations=[];
  if(rounds.length!==expectedRounds)roundViolations.push('matchday count mismatch');
  const observed=new Set();
  for(const r of rounds){
    if(!Number.isSafeInteger(r.number)||r.number<1||r.number>expectedRounds||observed.has(r.number))
      roundViolations.push(`invalid or repeated matchday ${r.number} at line ${r.line}`);
    observed.add(r.number);
    if(r.fixtures!==fixturesPerRound)
      roundViolations.push(`matchday ${r.number}: expected ${fixturesPerRound}, found ${r.fixtures}`);
  }
  if(unassignedFixtures.length)roundViolations.push('fixtures outside a matchday');
  const diagnosticViolations=[...roundViolations];
  if(unknownAnnotations.length)diagnosticViolations.push('unknown result annotation');
  if(halfTimeContradictions.length)diagnosticViolations.push('half-time score exceeds full-time score');
  return {
    structuralOnly:true,
    // Pass means only these mechanical checks passed, NEVER source/licensing/model approval.
    mechanicalChecksPassed:structure.ok&&diagnosticViolations.length===0,
    structure,
    roundCount:rounds.length,
    awardedCount:awarded.length,
    awarded,
    unknownAnnotations,
    halfTimeContradictions,
    unassignedFixtures,
    diagnosticViolations,
    // These rows are administrative outcomes, not observed goal-scoring events.
    ordinaryScoreRows:structure.parsedRows-awarded.length,
    // These are only SOURCE-REPORTED retrospective totals, never independently
    // authenticated goals or evidence of the licensing/quality of that season.
    totalsAreMechanicallyValid:structure.ok&&diagnosticViolations.length===0,
    playedScoreTotals,awardedScoreTotals,
  };
}

// Explicit local-file-only CLI. The audit cannot fetch upstream data or alter a DB.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3){
    console.error('Usage: node scripts/m0-source-quality.mjs LOCAL_FOOTBALL_TXT');
    process.exitCode=2;
  }else{
    try{
      const result=auditFootballTxtQuality(readFileSync(process.argv[2],'utf8'));
      console.log(JSON.stringify(result,null,2));
      if(!result.mechanicalChecksPassed)process.exitCode=1;
    }catch(error){
      console.error(error.message);
      process.exitCode=2;
    }
  }
}
