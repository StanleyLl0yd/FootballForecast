import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const aggregate=JSON.parse(readFileSync(
  new URL('../docs/M0_RPL_2026_27_EDITORIAL_AGGREGATE_CROSSCHECK.json',import.meta.url),'utf8'));
const evidence=JSON.parse(readFileSync(
  new URL('../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json',import.meta.url),'utf8'));

test('editorial vs publisher RPL aggregate cross-check is reproducible, not a rights/accuracy grant',()=>{
  assert.equal(aggregate.schemaVersion,1);
  assert.equal(aggregate.kind,'M0_MANUAL_AGGREGATE_RESEARCH_NOT_FIXTURE_LEVEL');
  assert.equal(aggregate.season,'2026/2027');
  assert.equal(aggregate.roundsCompleted,11);
  const r=aggregate.reference,c=aggregate.candidate,i=aggregate.inferences;
  assert.match(r.url,/^https:\/\/www\.sports\.ru\/football\/tournament\/rfpl\/table\//);
  assert.equal(r.listedClubCount,16);
  assert.equal(r.listedTeamMatches,11);
  assert.equal(r.totalTeamMatchAppearances,r.listedClubCount*r.listedTeamMatches);
  assert.equal(r.derivedUniqueMatches,r.totalTeamMatchAppearances/2);
  assert.equal(r.teamWins,r.teamLosses);
  assert.equal(r.teamDraws%2,0);
  assert.equal(r.teamWins+r.teamDraws/2,r.derivedUniqueMatches);
  assert.equal(r.teamWins+r.teamDraws+r.teamLosses,r.totalTeamMatchAppearances);
  assert.equal(r.leagueGoalsFor,r.leagueGoalsAgainst);
  const season=evidence.seasons.find(x=>x.season===aggregate.season);
  assert.ok(season);
  assert.equal(c.sourceSHA256,evidence.sourceSHA256);
  assert.equal(c.markedFinished,season.statuses.finished);
  assert.equal(c.markedScheduled,season.statuses.scheduled);
  assert.equal(c.declaredMatches,season.sourceRows);
  assert.equal(c.sourceReportedHomeResultGoals,
    season.sourceReportedScoresNotAuthenticatedOnField.home);
  assert.equal(c.sourceReportedAwayResultGoals,
    season.sourceReportedScoresNotAuthenticatedOnField.away);
  assert.equal(c.markedFinished,r.derivedUniqueMatches);
  assert.equal(c.sourceReportedHomeResultGoals+c.sourceReportedAwayResultGoals,
    r.leagueGoalsFor);
  assert.equal(i.samePlayedMatchCount,true);
  assert.equal(i.sameAllTeamGoalTotal,true);
});
test('aggregate coincidence cannot be converted into official accuracy, as-of or training permission',()=>{
  const {inferences:i,candidate:c,reference:r}=aggregate;
  for(const [key,value] of Object.entries(i)){
    if(!['samePlayedMatchCount','sameAllTeamGoalTotal'].includes(key))
      assert.equal(value,false,'must remain unverified: '+key);
  }
  for(const key of ['officialMatchAccuracyMeasured','sourceRightsVerified',
    'preMatchPublicationTimestampsVerified'])assert.equal(c[key],false,key);
  assert.equal(r.fromDatedOfficialProtocols,false);
  assert.equal(r.independentUnderlyingDataProviderVerified,false);
  for(const key of ['matchRows','fixtures','teamGoalTable','rawScores'])
    assert.ok(!(key in aggregate),'do not store source data: '+key);
  assert.match(aggregate.limitations,/share an upstream feed/);
  assert.match(aggregate.limitations,/awarded/);
});
