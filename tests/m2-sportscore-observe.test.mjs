import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSportScoreCurrentDay} from '../scripts/m2-sportscore-observe.mjs';

const DATE='2026-11-03';
const OBSERVED='2026-11-03T07:00:00Z';
const SEARCH={results:{competitions:[{
  name:'Russian Premier League',country:{name:'Russia'},slug:'russian-premier-league'
}]}};
const game={
  competition:'Russian Premier League',home:'Zenit',away:'Spartak',
  date:DATE,home_score:2,away_score:1
};
const inspect=(items=[game],search=SEARCH,day=DATE,at=OBSERVED)=>
  summarizeSportScoreCurrentDay(search,{fixtures:items},day,at);

test('one-day independent observation is attributed, aggregate only and non-authorizing',()=>{
  const r=inspect();
  assert.equal(r.kind,'M2_SPORTSCORE_SINGLE_DAY_RESEARCH_OBSERVATION');
  assert.equal(r.dateMatchedUniquePairs,1);
  assert.equal(r.scoreFieldsObservedNotVerified,1);
  assert.equal(r.interpretation,'PARTIAL_RESEARCH_OBSERVATION');
  assert.equal(r.attribution,'Powered by SportScore');
  for(const field of ['modelTrainingAuthorized','preMatchAvailabilityVerified',
    'completeSeasonCoverageVerified','completeDayCoverageVerified','holdoutRead',
    'privateRowsPersisted'])assert.equal(r[field],false);
  assert.equal(r.databaseWrites,0);
  assert.ok(!JSON.stringify(r).includes('Zenit'));
  assert.ok(!JSON.stringify(r).includes('Spartak'));
  assert.ok(!JSON.stringify(r).includes('2-1'));
});
test('duplicate, partial, out-of-day or unrecognized records never imply full coverage',()=>{
  assert.equal(inspect([game,game]).duplicateDirectedFixtures,1);
  assert.equal(inspect([game,game]).interpretation,'INCONCLUSIVE');
  assert.equal(inspect([{...game,date:'2026-11-02'}]).outOfDayRecords,1);
  assert.equal(inspect([{...game,date:'not a date'}]).missingOrInvalidDates,1);
  assert.equal(inspect([{...game,home:'Some Unknown Team'}]).unrecognizedTeams,1);
  assert.equal(inspect([{...game,date:'2026-11-03T09:00:00'}]).missingOrInvalidDates,1);
  const capped=inspect(Array.from({length:200},()=>({
    competition:'Some Other League',date:DATE
  })));
  assert.equal(capped.providerPageAtCap,true);
  assert.equal(capped.interpretation,'INCONCLUSIVE');
  assert.equal(inspect([]).interpretation,'NO_VERIFIED_CURRENT_DAY_RPL_OBSERVATIONS');
  assert.equal(inspect([{competition:'Some Other League',date:DATE}]).interpretation,
    'INCONCLUSIVE');
});
test('invalid day, stale or future research, arbitrary response and ambiguous league denied',()=>{
  for(const [rows,search,day,observed] of [
    [[game],SEARCH,'2025-11-03',OBSERVED],
    [[game],SEARCH,DATE,'2026-11-02T07:00:00Z'],
    [[game],SEARCH,DATE,'2026-11-03T07:00:00+00:00'],
    [[game],{results:{competitions:[]}},DATE,OBSERVED],
    [Array.from({length:201},()=>game),SEARCH,DATE,OBSERVED],
    [[game,null],SEARCH,DATE,OBSERVED]
  ])assert.throws(()=>inspect(rows,search,day,observed),
    /M2 SportScore observation refused/);
});
test('manual-only workflow verifies owner identity, no credentials and hard-coded origin',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/issue_comment:/);
  assert.match(workflow,/github\.event\.issue\.number == 182/);
  assert.match(workflow,/github\.actor == 'StanleyLl0yd'/);
  assert.match(workflow,/github\.event\.comment\.body == '\/m2-public-sources'/);
  assert.match(workflow,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/permissions: \{contents: read\}/);
  assert.match(workflow,/https:\/\/raw\.githubusercontent\.com\/openfootball\/europe\//);
  assert.match(workflow,/https:\/\/sportscore\.com\/api\/v1\/search/);
  assert.match(workflow,/node scripts\/m2-sportscore-observe\.mjs/);
  // The original public-source jobs stay secret-free; the separate owner-only
  // Starter job is explicitly gated and tested in m2-openfoot-rpl-diagnostic.
  const publicJobs=workflow.split('  bounded-openfoot-free-starter:')[0];
  assert.doesNotMatch(publicJobs,/secrets\\.|persist-credentials: true|DATABASE_URL|SUPABASE_SERVICE_ROLE|psql |cron:|schedule:|pull_request:/);
  assert.doesNotMatch(workflow,/footbolno\.ru|curl -L|--location|npm install/i);
});
