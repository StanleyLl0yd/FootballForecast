import assert from 'node:assert/strict';
import test from 'node:test';
import {auditFootballTxtQuality} from '../scripts/m0-source-quality.mjs';

const teams=Array.from({length:16},(_,i)=>`Team ${String(i+1).padStart(2,'0')}`);
const fixture=(home,away,suffix=' (0-0)')=>
  `    14:00  ${home.padEnd(24)}v ${away.padEnd(24)}1-0${suffix}`;
function valid(){
  const rows=teams.flatMap(home=>teams.filter(away=>away!==home).map(away=>fixture(home,away)));
  const lines=['= Synthetic League','# Teams 16','# Matches 240'];
  for(let i=0;i<30;i++)lines.push(`▪ Matchday ${i+1}`,...rows.slice(i*8,i*8+8));
  return lines.join('\n');
}
test('30 rounds of 8 fixtures pass mechanical checks without approval',()=>{
  const result=auditFootballTxtQuality(valid());
  assert.equal(result.mechanicalChecksPassed,true);
  assert.equal(result.structuralOnly,true);
  assert.equal(result.roundCount,30);
  assert.equal(result.awardedCount,0);
  assert.equal(result.ordinaryScoreRows,240);
  assert.ok(!('rightsApproved' in result));
});
test('awarded score is counted separately from played goals, not discarded',()=>{
  const source=valid().replace(fixture(teams[0],teams[1]),fixture(teams[0],teams[1],'    [awarded]'));
  const result=auditFootballTxtQuality(source);
  assert.equal(result.structure.ok,true);
  assert.equal(result.mechanicalChecksPassed,true);
  assert.equal(result.awardedCount,1);
  assert.equal(result.ordinaryScoreRows,239);
  assert.equal(result.awarded[0].score,'1-0');
});
test('unrecognized annotations and contradictory halves fail closed',()=>{
  const source=valid();
  const badTag=source.replace(fixture(teams[0],teams[1]),fixture(teams[0],teams[1],' [forfeit?]'));
  assert.deepEqual(auditFootballTxtQuality(badTag).diagnosticViolations,['unknown result annotation']);
  const badHalf=source.replace(fixture(teams[0],teams[1]),fixture(teams[0],teams[1],' (2-0)'));
  assert.deepEqual(auditFootballTxtQuality(badHalf).halfTimeContradictions.length,1);
  assert.equal(auditFootballTxtQuality(badHalf).mechanicalChecksPassed,false);
});
test('duplicate/missing matchdays and orientation mistakes are detected',()=>{
  const source=valid();
  assert.equal(auditFootballTxtQuality(source.replace('▪ Matchday 2','▪ Matchday 1')).mechanicalChecksPassed,false);
  const missingRound=source.replace('▪ Matchday 2\n','');
  assert.equal(auditFootballTxtQuality(missingRound).mechanicalChecksPassed,false);
  const reverse=source.replace(fixture(teams[0],teams[1]),fixture(teams[1],teams[0]));
  const result=auditFootballTxtQuality(reverse);
  assert.equal(result.roundCount,30);
  assert.equal(result.structure.directedPairs,239);
  assert.equal(result.mechanicalChecksPassed,false);
});
test('input types and unknown headers fail safely via structural gate',()=>{
  assert.throws(()=>auditFootballTxtQuality(null),TypeError);
  assert.equal(auditFootballTxtQuality('▪ Matchday 1\n    Spartak  v Sochi    1-0').mechanicalChecksPassed,false);
});
