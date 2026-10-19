import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcileFootballTxt} from '../scripts/m0-fixture-reconcile.mjs';

const clubs=['A Club','B Club','C Club','D Club'];
const fixture=(home,away,suffix=' (0-0)')=>
  '    14:00  '+home.padEnd(24)+'v '+away.padEnd(24)+'1-0'+suffix;
function sample(){
  const pairs=clubs.flatMap(home=>clubs.filter(away=>away!==home).map(away=>({home,away})));
  const txt=['= Synthetic League','# Teams 4','# Matches 12'];
  for(let round=0;round<6;round++){
    txt.push('▪ Matchday '+(round+1),'  Fri Jan 1 2027');
    for(const item of pairs.slice(round*2,round*2+2))txt.push(fixture(item.home,item.away));
  }
  const reference=pairs.map(item=>({...item,homeGoals:1,awayGoals:0,
    resultType:'played',date:'2027-01-01'}));
  return {txt:txt.join('\n'),reference};
}
const serialize=items=>items.map(x=>JSON.stringify(x)).join('\n');
const audit=(source,rows)=>reconcileFootballTxt(source,serialize(rows),
  {expectedTeams:4,expectedMatches:12});

test('matching independently supplied canonical fixtures pass mechanical checks only',()=>{
  const {txt,reference}=sample();
  const result=audit(txt,reference);
  assert.equal(result.comparisonPassed,true,JSON.stringify(result));
  assert.equal(result.qualityPassed,true);
  assert.equal(result.retrospectiveOnly,true);
  assert.equal(result.sourceApproval,false);
  assert.equal(result.independenceVerified,false);
  assert.match(result.primarySHA256,/^[a-f0-9]{64}$/);
  assert.notEqual(result.primarySHA256,result.referenceSHA256);
});
test('reversed home-away row is missing in one orientation even when goal sums match',()=>{
  const {txt,reference}=sample();
  const old=fixture(clubs[0],clubs[1]);
  const swapped=txt.replace(old,fixture(clubs[1],clubs[0]));
  const result=audit(swapped,reference);
  assert.equal(result.qualityPassed,false);
  assert.equal(result.comparisonPassed,false);
  assert.ok(result.missingFromReference.some(x=>x.home===clubs[1]&&x.away===clubs[0])===false);
  assert.ok(result.missingFromPrimary.some(x=>x.home===clubs[0]&&x.away===clubs[1]));
});
test('score, calendar date and awarded status are reconciled per directed fixture',()=>{
  const {txt,reference}=sample();
  reference[0].homeGoals=2;
  reference[1].date='2027-01-02';
  reference[2].resultType='awarded';
  const result=audit(txt,reference);
  assert.deepEqual(result.mismatches.map(x=>x.fields),[['homeGoals'],['date'],['resultType']]);
  assert.equal(result.comparisonPassed,false);
});
test('awarded fixtures preserve official result but are not ordinary played goals',()=>{
  const {txt,reference}=sample();
  const marked=txt.replace(fixture(clubs[0],clubs[1]),fixture(clubs[0],clubs[1],' [awarded]'));
  reference[0].resultType='awarded';
  const result=audit(marked,reference);
  assert.equal(result.awardedCount,1);
  assert.equal(result.comparisonPassed,true);
});
test('duplicate reference, malformed JSON, invalid date and missing rows all reject',()=>{
  const {txt,reference}=sample();
  assert.equal(audit(txt,[...reference,reference[0]]).comparisonPassed,false);
  assert.ok(audit(txt,[...reference,reference[0]]).referenceErrors.some(x=>x.reason.includes('duplicate')));
  const bad=serialize(reference)+'\n{';
  assert.equal(reconcileFootballTxt(txt,bad,{expectedTeams:4,expectedMatches:12}).comparisonPassed,false);
  reference[0].date='2027-02-30';
  assert.equal(audit(txt,reference).comparisonPassed,false);
  assert.equal(audit(txt,reference.slice(1)).comparisonPassed,false);
});
test('dates need explicit upstream year and correct weekday; no backdating assumptions',()=>{
  const {txt,reference}=sample();
  assert.equal(audit(txt.replace('Fri Jan 1 2027','Sat Jan 1 2027'),reference).comparisonPassed,false);
  assert.equal(audit(txt.replace('Fri Jan 1 2027','Fri Jan 1'),reference).comparisonPassed,false);
  assert.throws(()=>reconcileFootballTxt(null,''),TypeError);
});
