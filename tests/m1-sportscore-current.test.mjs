import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareSportScoreCurrent} from '../scripts/m1-sportscore-current.mjs';

const SEARCH={results:{competitions:[{name:'Russian Premier League',
  country:{name:'Russia'},slug:'russian-premier-league'}]}};
const RETRIEVED='2026-10-29T15:00:00Z';
const DATE='2026-10-29';
const sourceRow={
  season:'2026/2027',sourceMatchId:'f1',
  homeTeam:'Зенит',awayTeam:'Спартак',
  calendarDateUtc:DATE,quarantineReason:null,
  status:'finished',homeGoals:2,awayGoals:1
};
const apiRow={
  competition:'Russian Premier League',
  home:'Zenit',away:'Spartak',
  date:DATE,home_score:2,away_score:1
};
const run=(api=[apiRow],source=[sourceRow],search=SEARCH,date=DATE)=>
  compareSportScoreCurrent(search,{fixtures:api},
    source.map(x=>JSON.stringify(x)).join('\n')+'\n',date,RETRIEVED);
test('current one-day attributed match and score corroboration contains no raw teams',()=>{
  const report=run();
  assert.equal(report.matchedDirectedFixtures,1);
  assert.equal(report.finishedScoreDisagreements,0);
  assert.equal(report.agreementForMatchedFields,true);
  assert.equal(report.queriedOneDay,true);
  assert.equal(report.attribution,'Powered by SportScore');
  assert.equal(report.trainedOnSportScore,false);
  assert.equal(report.historicalAsOfVerified,false);
  assert.ok(!JSON.stringify(report).includes('Зенит'));
  assert.ok(!JSON.stringify(report).includes('Zenit'));
});
test('divergent score and stale scores become disagreement, not a silent overwrite',()=>{
  const report=run([{...apiRow,away_score:0}]);
  assert.equal(report.matchedDirectedFixtures,1);
  assert.equal(report.finishedScoreDisagreements,1);
  assert.equal(report.agreementForMatchedFields,false);
});
test('unknown teams, duplicate IDs, wrong dates and capped pages block confident claims',()=>{
  assert.equal(run([{...apiRow,home:'Unknown Team'}]).providerUnmappedTeams,1);
  assert.equal(run([apiRow,apiRow]).duplicateProviderFixtures,1);
  assert.equal(run([{...apiRow,date:'2026-10-28'}]).kickoffDateDisagreements,1);
  assert.equal(run(Array.from({length:200},()=>({competition:'Some League'}))).pageCapped,true);
});
test('quarantined Footbolno fixture stays excluded from daily comparison',()=>{
  const report=run([apiRow],[{...sourceRow,quarantineReason:'stale_scheduled'}]);
  assert.equal(report.sourceMatchesOnDay,0);
  assert.equal(report.matchedDirectedFixtures,0);
  assert.equal(report.agreementForMatchedFields,false);
});
test('no-match day and unavailable day coverage remain inconclusive, not fabricated conflict',()=>{
  const noMatches=run([],[{...sourceRow,calendarDateUtc:'2026-10-30'}]);
  assert.equal(noMatches.dayComparisonStatus,'NO_RPL_MATCHES');
  assert.equal(noMatches.fieldConflictDetected,false);
  assert.equal(noMatches.agreementForMatchedFields,false);
  const missingApi=run([],[sourceRow]);
  assert.equal(missingApi.dayComparisonStatus,'INCONCLUSIVE');
  assert.equal(missingApi.fieldConflictDetected,false);
});
test('ambiguous slug, unsafe day ranges and duplicate provider schedule fail closed',()=>{
  assert.throws(()=>run([apiRow],[sourceRow],{results:{competitions:[]}}),/unique verified RPL/);
  assert.throws(()=>run([apiRow],[sourceRow],SEARCH,'2026-10-25'),/only today/);
  assert.throws(()=>run([apiRow], [sourceRow,{...sourceRow,sourceMatchId:'f2'}]),
    /duplicate publisher/);
  assert.throws(()=>run(Array.from({length:201},()=>apiRow)),/oversized API/);
});
