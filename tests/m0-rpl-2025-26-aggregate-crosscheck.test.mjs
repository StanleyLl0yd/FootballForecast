import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = name => JSON.parse(readFileSync(new URL('../docs/'+name,import.meta.url),'utf8'));
const x=read('M0_RPL_2025_26_AGGREGATE_CROSSCHECK.json');
const evidence=read('M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
const scope=read('M0_MINIMUM_RPL_SCOPE.json');

test('2025/26 free-source aggregate documents one unresolved discrepancy',()=>{
  assert.equal(x.schemaVersion,1);
  assert.equal(x.season,'2025/2026');
  assert.ok(scope.minimumScope.some(s=>s.season===x.season&&s.role==='sealed_holdout'));
  assert.equal(x.candidates.length,1);
  const c=x.candidates[0],observed=evidence.seasons.find(s=>s.season===x.season);
  assert.ok(observed);
  assert.equal(c.sourceSHA256,evidence.sourceSHA256);
  assert.equal(c.sourceReportedMatches,observed.sourceRows);
  assert.equal(observed.statuses.finished,240);
  assert.equal(c.sourceReportedGoalsHome,observed.sourceReportedScoresNotAuthenticatedOnField.home);
  assert.equal(c.sourceReportedGoalsAway,observed.sourceReportedScoresNotAuthenticatedOnField.away);
  assert.equal(c.sourceReportedGoalsTotal,c.sourceReportedGoalsHome+c.sourceReportedGoalsAway);
  assert.equal(c.sourceReportedGoalsTotal,609);
  assert.equal(x.references.length,3);
  const byName=Object.fromEntries(x.references.map(s=>[s.name,s]));
  for(const name of ['RSSSF Russia 2025/26','Championat RPL 2025/26']){
    assert.equal(byName[name].reportedMatches,240);
    assert.equal(byName[name].reportedGoals,609);
  }
  assert.equal(byName['Championat RPL 2025/26'].reportedGoalsHome,348);
  assert.equal(byName['Championat RPL 2025/26'].reportedGoalsAway,261);
  assert.equal(byName['Rusfootball RPL 2025/26'].reportedGoals,610);
  assert.equal(x.analysis.nonmatchingGoalDelta,1);
  assert.equal(x.analysis.nonmatchingSource,'Rusfootball');
});

test('no source is certified as independent, error-free, licensed or safe to train',()=>{
  assert.equal(x.kind,'M0_MANUAL_EDITORIAL_AGGREGATE_CROSSCHECK_NOT_MATCH_LEVEL');
  for(const ref of x.references){
    assert.match(ref.url,/^https:\/\//);
    assert.equal(ref.originIndependenceVerified,false);
  }
  for(const [k,v]of Object.entries(x.analysis))
    if(k.startsWith('is')||k.endsWith('Approved')||k.endsWith('Enabled')||k.endsWith('CertifiedForModeling'))
      assert.equal(v,false,k);
  assert.equal(evidence.providerRightsApproved,false);
  assert.equal(evidence.authorizedForAutomatedTraining,false);
  assert.match(x.limitations,/No data import/);
  for(const key of ['matchRows','rawScores','teamDetails','fixtures'])
    assert.equal(Object.hasOwn(x,key),false);
});
