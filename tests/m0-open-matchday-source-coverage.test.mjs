import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const report=read('../docs/M0_OPEN_MATCHDAY_RPL_2026_27_EVIDENCE.json');
const footbolno=read('../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
const editorial=read('../docs/M0_RPL_2026_27_EDITORIAL_AGGREGATE_CROSSCHECK.json');
const season=footbolno.seasons.find(x=>x.season==='2026/2027');

test('research records an immutable Github publisher build and only aggregate statistics',()=>{
  assert.equal(report.schemaVersion,1);
  assert.equal(report.provider.id,'open-matchday-rpl');
  assert.match(report.provider.repository,/^https:\/\/github\.com\/oladeeayo\/open-matchday$/);
  for(const name of ['commitSHA','results.gitBlobSHA1','fixtures.gitBlobSHA1',
    'buildSummaryBlobSHA1','disclaimerBlobSHA1']){
    const sha=name.split('.').reduce((o,k)=>o[k],report.provider);
    assert.match(sha,/^[0-9a-f]{40}$/,name);
  }
  assert.equal(report.provider.generatedUTCFromPublisher,'2026-10-20T03:10:46Z');
  assert.equal(report.provider.results.path,'data/RUS_1_premier-liga/results_2627.csv');
  assert.equal(report.provider.fixtures.path,'data/RUS_1_premier-liga/fixtures_2627.csv');
  assert.equal(report.provider.results.headerColumns,25);
  assert.equal(report.provider.fixtures.headerColumns,5);
  assert.equal(report.provider.sourceUpstreamForResults,'soccerway');
  assert.match(report.provider.disclaimer,/noncommercial only/);
  assert.equal(report.purpose.includes('no raw records'),true);
});
test('current season coverage and four-goal deficit are grounded in earlier immutable evidence',()=>{
  assert.ok(season);
  const p=report.provider,x=report.comparativeSnapshot;
  assert.equal(p.results.rows,87);
  assert.equal(p.fixtures.rows,109);
  assert.equal(p.results.sourceReportedGoalsTotal,242);
  assert.equal(x.otherSHA256,footbolno.sourceSHA256);
  assert.equal(x.footbolnoSourceFinished,season.statuses.finished);
  assert.equal(x.footbolnoSourceScheduled,season.statuses.scheduled);
  assert.equal(x.footbolnoSourceResultGoalsTotal,
    season.sourceReportedScoresNotAuthenticatedOnField.home+
    season.sourceReportedScoresNotAuthenticatedOnField.away);
  assert.equal(x.footbolnoSourceResultGoalsTotal,
    editorial.reference.leagueGoalsFor);
  assert.equal(x.matchResultShortfall,x.footbolnoSourceFinished-p.results.rows);
  assert.equal(x.upcomingFixturesShortfall,x.footbolnoSourceScheduled-p.fixtures.rows);
  assert.equal(x.goalAggregateShortfall,
    x.footbolnoSourceResultGoalsTotal-p.results.sourceReportedGoalsTotal);
  assert.equal(x.combinedRecordShortfallVsExpectedRpl240,
    season.sourceRows-(p.results.rows+p.fixtures.rows));
  assert.equal(x.matchResultShortfall,1);
  assert.equal(x.upcomingFixturesShortfall,43);
  assert.equal(x.goalAggregateShortfall,4);
  assert.equal(x.combinedRecordShortfallVsExpectedRpl240,44);
});
test('noncommercial Soccerway-derived free source is always restricted research only',()=>{
  for(const [name,approved] of Object.entries(report.approvals))
    assert.equal(approved,false, 'source cannot be approved by metadata inspection: '+name);
  assert.match(report.limitations,/publisher's informational non-commercial terms/);
  assert.match(report.limitations,/Missing aggregate four goals does not identify the missing match/);
  const sensitive=['matchRows','rawMatches','teamNames','kickoffDates',
    'sourceText','goalEvents','rawResults'];
  for(const key of sensitive)
    assert.ok(!(key in report)&&!(key in report.provider),
      'provider rows must not enter evidence JSON');
});
