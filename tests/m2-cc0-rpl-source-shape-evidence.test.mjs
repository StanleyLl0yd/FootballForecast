import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const evidence = JSON.parse(readFileSync(
  new URL('../docs/M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json', import.meta.url),
  'utf8'
));
const seasons = ['2018/19','2019/20','2020/21','2023/24','2024/25'];

test('CC0 evidence pins five historical development-only sources and git content identities', () => {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.kind, 'M2_INDEPENDENT_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_OBSERVATION');
  assert.equal(evidence.asOf, '2026-11-05');
  assert.deepEqual(evidence.developmentSeasonsObserved.map(x => x.season), seasons);
  assert.equal(evidence.sourceRepositories.length, 2);
  for (const source of evidence.sourceRepositories) {
    assert.equal(source.publisherDeclaredLicense, 'CC0-1.0');
    assert.match(source.pinnedCommitSha, /^[a-f0-9]{40}$/);
    assert.equal(source.upstreamIndividualRecordRightsIndependentlyVerified, false);
  }
  for (const row of evidence.developmentSeasonsObserved) {
    assert.ok(evidence.sourceRepositories.some(s => s.repository === row.repository));
    assert.match(row.gitBlobSha, /^[a-f0-9]{40}$/);
    assert.equal(row.structuralMatchRows, 240);
    assert.equal(row.clubStrings, 16);
    assert.equal(row.structurallyValidFullTimePairs, 240);
    assert.equal(row.notProvenPlayedRows, 240);
    assert.ok(row.rowsWithoutExplicitClockTime >= 0);
  }
  assert.equal(evidence.developmentSeasonsObserved.reduce(
    (n, row) => n + row.structuralMatchRows, 0
  ), 1200);
  assert.deepEqual(evidence.unavailableInCheckedCc0RplPaths, ['2021/22', '2022/23']);
});

test('explicitly awarded results and ambiguous text fixture pair are not silently approved', () => {
  const [s18,s19,s20,s23,s24] = evidence.developmentSeasonsObserved;
  assert.deepEqual(
    [s18.explicitAwardedStatusRows, s19.explicitAwardedStatusRows,
      s20.explicitAwardedStatusRows], [0, 4, 2]
  );
  assert.equal(s19.unclassifiedStatusRows, 236);
  assert.equal(s20.unclassifiedStatusRows, 238);
  assert.equal(s23.directedRoundRobinValid, false);
  assert.equal(s23.uniqueDirectedPairs, 239);
  assert.equal(s23.directedPairDuplicateCount, 1);
  assert.equal(s23.directedPairMissingCount, 1);
  assert.equal(s23.teamsNot15Home15Away, 2);
  assert.equal(s24.directedRoundRobinValid, true);
  assert.equal(s24.uniqueDirectedPairs, 240);
  assert.deepEqual([s19.rowsWithoutExplicitClockTime, s20.rowsWithoutExplicitClockTime,
    s23.rowsWithoutExplicitClockTime, s24.rowsWithoutExplicitClockTime], [2,2,19,24]);
  assert.equal(evidence.limitations.technicalAwardedScoresCountAsPlayed, false);
  assert.equal(evidence.limitations.unsafe2023DirectedPairsAutomaticallyRepaired, false);
});

test('evidence has no source rows, sealed holdout observations or training authorization', () => {
  const x = evidence.limitations;
  for (const key of [
    'upstreamSourceRecordsIndependentlyCorroborated',
    'initialPublisherHistoricalAsOfTimeVerified',
    'sourceMatchIdentityCrosswalkApproved',
    'reportedScoresIndependentlyMatchedToPrivateSource',
    'historicalWeatherOrOddsSourceApproved',
    'multiseasonModelTrainingApproved',
    'sealedHoldout2025_26Read',
    'rawMatchNamesIdsScoresOrRowsRetainedInGit'
  ]) assert.equal(x[key], false, key);
  assert.equal(x.researchOnlyNoProductionUse, true);
  assert.equal(x.m2AcceptanceTasksComplete, 4);
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /"homeTeam"|"awayTeam"|"team1"|"team2"|"goals"|"score"/);
  assert.doesNotMatch(serialized, /"matchId"|"sourceMatchId"|"playerName"|"clubId"/);
});
