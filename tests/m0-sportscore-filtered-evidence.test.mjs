import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const evidence=JSON.parse(readFileSync(new URL(
  '../docs/M0_SPORTSCORE_FILTERED_RPL_EVIDENCE.json',import.meta.url),'utf8'));

test('pinned six-day source report has reproducible 16/16 coverage only for bounded dates',()=>{
  const e=evidence;
  assert.equal(e.schemaVersion,1);
  assert.equal(e.kind,'M0_BOUNDED_TWO_PUBLISHER_CURRENT_FIXTURE_AGREEMENT_NOT_APPROVAL');
  assert.equal(e.season,'2026/2027');
  assert.match(e.research.runUrl,/\/actions\/runs\/39816513768$/);
  assert.equal(e.research.jobId,119956332536);
  assert.equal(e.research.searchCandidates,1);
  assert.equal(e.research.validatedRplCompetitionCount,1);
  assert.equal(e.research.searchSlugPersisted,false);
  assert.equal(e.dayRecords.length,6);
  assert.deepEqual(e.dayRecords.map(x=>x.utcDate),[
    '2026-10-17','2026-10-18','2026-10-19',
    '2026-10-23','2026-10-24','2026-10-25']);
  for(const row of e.dayRecords){
    assert.equal(row.httpStatus,200);
    assert.equal(row.capped,false);
    assert.equal(row.unknownSchema,false);
    assert.equal(row.unresolved,0);
    assert.equal(row.completedScoreDisagreements,0);
    assert.equal(row.publisherFixtures,row.sportscoreFixtures);
    assert.equal(row.directedPairMatches,row.publisherFixtures);
    assert.ok(Number.isInteger(row.directedPairMatches)&&row.directedPairMatches>0);
  }
  for(const key of ['publisherFixtures','sportscoreFixtures','directedPairMatches'])
    assert.equal(e.dayRecords.reduce((sum,x)=>sum+x[key],0),16);
  assert.equal(e.aggregates.matchedDirectedFixtures,16);
  assert.equal(e.aggregates.queryHttp200,6);
  assert.equal(e.aggregates.atPageCap,0);
  assert.equal(e.aggregates.finishedFixturesPriorToObservation,8);
  assert.equal(e.aggregates.scheduledFixturesAtObservation,8);
  assert.equal(e.aggregates.seasonTotalFixturesFromCandidate,240);
  assert.equal(e.aggregates.reportedScoreDisagreementsForCompletedMatches,0);
});
test('six matched public source dates must never imply season, legal or time-series approval',()=>{
  const e=evidence;
  assert.equal(e.inferences.selectedSixDaysHaveFullCrossPublisherMatchAgreement,true);
  for(const [key,value] of Object.entries(e.inferences)){
    if(key!=='selectedSixDaysHaveFullCrossPublisherMatchAgreement')
      assert.equal(value,false,'do not imply M0 source approval: '+key);
  }
  assert.equal(e.research.noScheduledPolling,true);
  assert.equal(e.research.paidUsage,false);
  assert.equal(e.research.authenticatedRequests,false);
  assert.equal(e.sources[0].declaredLicense,'CC BY 4.0');
  assert.equal(e.sources[1].declaredAccess,'anonymous attribution tier');
  assert.match(e.limitations,/16-fixture agreement/);
  assert.match(e.limitations,/terms priority remains unresolved/);
  const published=JSON.stringify(e);
  for(const raw of ['match_id','home_id','away_id','team_id','home_score',
    'away_score','providerFixtureId','searchSlugValue','slugValue'])
    assert.ok(!published.includes('"'+raw+'":'),'do not persist raw source row field: '+raw);
});
