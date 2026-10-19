import assert from 'node:assert/strict';
import test from 'node:test';
import {auditFootballTxt} from '../scripts/m0-fixture-structure.mjs';

const clubs=Array.from({length:16},(_,i)=>'Team '+String(i+1).padStart(2,'0'));
function makeFixture(home,away,score='1-0'){
  return '    14:00  '+home.padEnd(24)+'v '+away.padEnd(24)+score+' (0-0)';
}
function complete(){
  const fixtures=clubs.flatMap(home=>clubs.filter(away=>away!==home)
    .map(away=>makeFixture(home,away)));
  return ['= Synthetic test league','# Teams 16','# Matches 240','▪ Matchday 1',...fixtures].join('\n');
}
test('strictly structural: 16 clubs and both orientations of 240 synthetic fixtures',()=>{
  const result=auditFootballTxt(complete());
  assert.equal(result.ok,true,JSON.stringify(result.violations));
  assert.equal(result.structuralOnly,true);
  assert.equal(result.matchRows,240);
  assert.equal(result.directedPairs,240);
  assert.deepEqual(result.duplicatePairs,[]);
  assert.deepEqual(result.missingPairs,[]);
});
test('reversed home/away fixture creates duplicate and missing inverse even at 240 rows',()=>{
  const original=complete();
  const home='Team 01',away='Team 02';
  // Simulates the observed 2023/24 Sochi/Spartak orientation problem.
  const wrong=original.replace(makeFixture(home,away),makeFixture(away,home));
  const result=auditFootballTxt(wrong);
  assert.equal(result.matchRows,240);
  assert.equal(result.directedPairs,239);
  assert.equal(result.ok,false);
  assert.ok(result.duplicatePairs.some(x=>x.home===away&&x.away===home&&x.lines.length===2));
  assert.ok(result.missingPairs.some(x=>x.home===home&&x.away===away));
  assert.ok(result.violations.includes('duplicate directed fixtures'));
});
test('bad scores, dropped match lines and contradictory headers fail closed',()=>{
  const completeSet=complete();
  const invalid=completeSet.replace(makeFixture(clubs[0],clubs[1]),makeFixture(clubs[0],clubs[1],'-1-0'));
  assert.equal(auditFootballTxt(invalid).ok,false);
  assert.equal(auditFootballTxt(invalid).invalidRows.length,1);
  const shortened=completeSet.replace(makeFixture(clubs[0],clubs[1])+'\n','');
  assert.equal(auditFootballTxt(shortened).matchRows,239);
  assert.equal(auditFootballTxt(shortened).ok,false);
  const wrongHeader=completeSet.replace('# Matches 240','# Matches 239');
  assert.equal(auditFootballTxt(wrongHeader).ok,false);
});
test('the auditor cannot verify time-travel, attribution or permissions',()=>{
  const result=auditFootballTxt(complete());
  assert.equal(result.structuralOnly,true);
  assert.ok(!('rightsApproved' in result));
  assert.ok(!('historicalAsOfValidated' in result));
  assert.throws(()=>auditFootballTxt(null),TypeError);
  assert.throws(()=>auditFootballTxt('sample',{expectedTeams:0}),RangeError);
});
