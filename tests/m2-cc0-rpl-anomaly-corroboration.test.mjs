import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const receipt = JSON.parse(readFileSync(
  new URL('../docs/M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json', import.meta.url), 'utf8'
));
const shape = JSON.parse(readFileSync(
  new URL('../docs/M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json', import.meta.url), 'utf8'
));

test('anomaly receipt preserves original immutable evidence and pinned public publisher versions', () => {
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.kind, 'M2_INDEPENDENT_CC0_RPL_ANOMALY_CORROBORATION');
  assert.equal(receipt.priorShapeEvidence, 'M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json');
  const p = receipt.scheduleSwap;
  const pinned = shape.developmentSeasonsObserved.find(row => row.season === p.season);
  assert.ok(pinned);
  assert.equal(p.publisherBlobSha, pinned.gitBlobSha);
  assert.equal(p.publisherPath, pinned.path);
  assert.equal(p.publisherCommitSha, shape.sourceRepositories.find(
    row => row.repository === p.repository
  ).pinnedCommitSha);
  assert.equal(p.duplicateDirectedPairs, pinned.directedPairDuplicateCount);
  assert.equal(p.missingDirectedPairs, pinned.directedPairMissingCount);
  for (const season of receipt.awarded.bySeason) {
    const row = shape.developmentSeasonsObserved.find(x => x.season === season.season);
    assert.ok(row);
    assert.equal(row.gitBlobSha, season.publisherBlobSha);
    assert.equal(row.path, season.publisherPath);
    assert.equal(row.explicitAwardedStatusRows, season.declaredAwardedRows);
  }
});

test('September 2023 venue swap is independently evidenced but cannot auto-repair source', () => {
  const {scheduleSwap:s} = receipt;
  assert.deepEqual(s.originalTextLineNumbers, [113, 328]);
  assert.equal(s.changedFixture.publisherTextLineNumber, 113);
  assert.equal(s.changedFixture.matchday, 8);
  assert.equal(s.changedFixture.calendarDate, '2023-09-16');
  assert.equal(s.changedFixture.recordedHomeAwayDirectionCorrect, false);
  assert.equal(s.changedFixture.officialRevisedHomeAwayDirectionCorroborated, true);
  assert.equal(s.changedFixture.originalChangeNoticePublishedBeforeMatch, true);
  assert.equal(s.changedFixture.playedResultCorroborated, true);
  assert.equal(s.automaticArchiveCorrectionPermitted, false);
  const notice = s.evidence.find(x => x.kind === 'CLUB_OFFICIAL_PREMATCH_SWITCH_ANNOUNCEMENT');
  assert.equal(notice.publishedDate, '2023-09-07');
  assert.ok(s.evidence.some(x => x.kind === 'FEDERATION_SEASON_CALENDAR'));
  assert.ok(s.evidence.some(x => x.kind === 'INDEPENDENT_MATCH_REPORT'));
});

test('all six explicitly awarded rows have individual independent non-played-result references', () => {
  assert.equal(receipt.awarded.explicitlyAwardedRows, 6);
  assert.equal(receipt.awarded.independentlyCorroboratedAsNotPlayed, 6);
  const seasons = receipt.awarded.bySeason;
  assert.deepEqual(seasons.map(s => [s.season, s.declaredAwardedRows]), [
    ['2019/20', 4], ['2020/21', 2]
  ]);
  let seen = new Set();
  for(const season of seasons) {
    assert.equal(season.observations.length, season.declaredAwardedRows);
    assert.equal(season.notPlayedCorroboratedRows, season.declaredAwardedRows);
    for(const item of season.observations) {
      assert.ok(Number.isInteger(item.zeroBasedSourceIndex));
      assert.ok(item.zeroBasedSourceIndex >= 0 && item.zeroBasedSourceIndex < 240);
      assert.match(item.calendarDate, /^20\d{2}-\d{2}-\d{2}$/);
      const key = season.season + ':' + item.zeroBasedSourceIndex;
      assert.ok(!seen.has(key), key);
      seen.add(key);
    }
  }
  assert.equal(seen.size, 6);
  assert.equal(receipt.awarded.eligibleAsPlayedGoals, false);
  assert.equal(receipt.awarded.removeAwardedFromFuturePlayedGoalFitting, true);
});

test('citations are bounded public HTTPS references and holdout / private data remain untouched', () => {
  const allowed = new Set([
    'pfcsochi.ru', 'www.rfs.ru', 'www.championat.com',
    'bombardir.ru', 'news.sportbox.ru'
  ]);
  const urls = [
    ...receipt.scheduleSwap.evidence.map(x => x.url),
    ...receipt.awarded.bySeason.flatMap(x => x.observations.map(y => y.evidenceUrl))
  ];
  assert.equal(urls.length, 9);
  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:');
    assert.ok(allowed.has(parsed.hostname), parsed.hostname);
  }
  const restrictions = receipt.limitations;
  for(const key of [
    'allOtherCc0RowsIndependentlyVerified',
    'sourcePublisherInitialHistoricalAvailabilityVerified',
    'upstreamOriginalRecordRightsVerified',
    'privateSourceRowsRead',
    'privateTeamIdentityCrosswalkApproved',
    'automaticallyModifiedSourceOrPrivateSnapshots',
    'multiseasonTrainingApproved',
    'sealedHoldout2025_26Read',
    'rawMatchNamesScoresOrPrivateIdsRetainedInGit',
    'm3Authorized'
  ]) assert.equal(restrictions[key], false, key);
  assert.equal(restrictions.onlySpecificPublicAnomaliesReviewed, true);
  assert.equal(restrictions.m2AcceptanceTasksComplete, 4);
  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(serialized, /"(?:team1|team2|homeTeam|awayTeam|homeGoals|awayGoals|score|matchId|sourceMatchId|clubId)"\s*:/);
});

test('both 2023/24 swapped fixtures have distinct dated match-level stadium evidence', () => {
  const x = receipt.venueSwapMatchEvidence;
  assert.equal(x.kind, 'MATCH_LEVEL_HISTORICAL_STADIUM_CROSSCHECK');
  assert.equal(x.season, '2023/24');
  assert.equal(x.matchCount, 2);
  assert.deepEqual(x.samples.map(m => [m.matchday, m.calendarDate, m.venueNameAtMatchTime, m.city]), [
    [8, '2023-09-16', 'Открытие Банк Арена', 'Москва'],
    [24, '2024-04-13', 'Фишт', 'Сочи']
  ]);
  assert.equal(x.officialFederationSwapDecision.publishedDate, '2023-09-07');
  const allowed = new Set(['www.rfs.ru', 'pfcsochi.ru', 'www.championat.com', 'static.sportbox.ru']);
  const urls = [x.officialFederationSwapDecision.url];
  for (const match of x.samples) {
    assert.ok(match.officialPrematchVenueNotice.publishedDate < match.calendarDate);
    urls.push(match.officialPrematchVenueNotice.url, match.independentPlayedVenueReportUrl);
  }
  assert.equal(urls.length, 5);
  for (const raw of urls) {
    const u = new URL(raw);
    assert.equal(u.protocol, 'https:');
    assert.ok(allowed.has(u.hostname), u.hostname);
  }
  for (const flag of [
    'allSeasonVenuesIndependentlyVerified',
    'preciseVenueCoordinatesVerified',
    'originalPublisherFirstAvailabilityAtExactUtcTimeVerified',
    'upstreamMatchRightsForAutomatedModelUseVerified',
    'privateFixtureCrosswalkApproved',
    'eligibleForActualWeatherFeatureJoin',
    'multiseasonModelTrainingApproved',
    'sealedHoldout2025_26Read'
  ]) assert.equal(x[flag], false, flag);
  assert.equal(x.historicalVenueMatchLevelCrosscheckSupported, true);
  assert.equal(receipt.limitations.m2AcceptanceTasksComplete, 4);
});

test('two separately published approximate stadium locations remain non-operational research references', () => {
  const swap = receipt.venueSwapMatchEvidence;
  const candidate = swap.coordinateReferenceCandidates;
  assert.equal(candidate.kind, 'APPROXIMATE_PUBLIC_VENUE_POINT_REFERENCES_NOT_HISTORICAL_WEATHER_EVIDENCE');
  assert.equal(candidate.sourceScope, 'READ_ONLY_PUBLIC_STADIUM_LOCATION_PAGES');
  assert.equal(candidate.matches.length, 2);
  assert.equal(candidate.allDatesMatchPriorIndependentPlayedVenueSamples, true);
  assert.equal(candidate.publishedLocationSourcesAreSeparatePages, true);
  const allowed = new Set(['archi.ru', 'superfan.ru']);
  for (const [i, row] of candidate.matches.entries()) {
    assert.equal(row.calendarDate, swap.samples[i].calendarDate);
    assert.equal(row.venueNameAtMatchTime, swap.samples[i].venueNameAtMatchTime);
    const a = row.architecturalReference;
    const b = row.separateStadiumDirectoryReference;
    for (const point of [a, b]) {
      assert.equal(typeof point.latitude, 'number');
      assert.equal(typeof point.longitude, 'number');
      assert.ok(Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90);
      assert.ok(Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180);
      const u = new URL(point.url);
      assert.equal(u.protocol, 'https:');
      assert.ok(allowed.has(u.hostname), u.hostname);
    }
    assert.notEqual(a.url, b.url);
    assert.ok(Math.abs(a.latitude - b.latitude) < 0.001);
    assert.ok(Math.abs(a.longitude - b.longitude) < 0.001);
  }
  for (const flag of [
    'sourceSurveyMethodsOrOriginalProvenanceIndependentlyValidated',
    'historicalMatchDaySiteSurveyOrPointPrecisionVerified',
    'forecastProviderSpatialGridAndPitchExposureVerified',
    'originalForecastFirstAvailableBeforeCutoffVerified',
    'privateSourceFixtureIdentityCrosswalkApproved',
    'approvedForHistoricalWeatherFeatureJoin',
    'approvedForMultiseasonTraining',
    'sealedHoldout2025_26Read'
  ]) assert.equal(candidate[flag], false, flag);
  assert.equal(swap.preciseVenueCoordinatesVerified, false);
  assert.equal(swap.eligibleForActualWeatherFeatureJoin, false);
  assert.equal(receipt.limitations.m2AcceptanceTasksComplete, 4);
});
