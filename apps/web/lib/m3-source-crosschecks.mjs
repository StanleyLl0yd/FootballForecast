/**
 * Bounded, public-safe M3-A3 receipts for the existing owner-only research page.
 * This is a display/consistency gate, NOT SQL attestation, source-rights
 * approval, individual fixture matching or real model eligibility.
 */
const YEARS = Object.freeze(['2018/19','2019/20','2020/21','2023/24','2024/25']);
const GRAPH_DENIALS = [
  'privateIdsExported','privateRowsExported','privateSourceMatchIdsExported',
  'privateIndividualScoreValuesExported','publicMatchRecordsCommitted',
  'sourceClubLegalIdentityIndependentlyCertified','crossSourceIndependentOriginalFeedVerified',
  'actualKickoffUtcVerified','originalFirstServingUtcVerified',
  'playedVsAwardedGoalStatusVerified','sourceTrainingRightsVerified',
  'originalSourceLicenseForDerivedModelVerified','allSevenSeasonsCovered',
  'independentlyEligiblePrivateRowsCertified','heldoutDataRead','realModelFitted',
  'supabaseTablesMutated','rlsModified','productionModelChanged','modelEscrowChanged'
];
const CLOCK_DENIALS = [
  'publicTimeZoneMetadataFirstPublishedValidated','historicalKickoffOriginalUtcAuthenticated',
  'privateFixtureIdsExported','privateMatchRowsExported','privateUtcMinuteHistogramExported',
  'sourceClocksIndependentlyHistoricalAsOfVerified','actualOnFieldKickoffMinutesVerified',
  'publicMissingTimesFilled','sourceRightsVerified','fullSevenSeasonCoverageProven',
  'privateClubIdentityMapped','playedResultStatusVerified','realModelTrainingAuthorized',
  'holdout2025_26Read','productionModelChanged','m3A3Accepted'
];
const RFS_DENIALS = [
  'allSeasonFixturesReviewed','privateMatchIdsExported','privateTeamIdsExported',
  'privateRowsExported','privatePerMatchScoresExported','privateSourceModified',
  'privateClubLegalIdentityIndependentlyCertified',
  'originalKickoffUtcIndependentlyAuthenticated','originalRfsNoticeServingUtcVerified',
  'sourceFirstServingUtcVerified','sourceTrainingRightsVerified',
  'playedGoalStatusForEachPrivateFixtureVerified',
  'full2021_22Or2022_23DatasetValidated','realModelTrainingAuthorized',
  'holdout2025_26Read','m3A3Accepted','productionModelChanged'
];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => plain(value) &&
  Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const denied = (value, expected) => keys(value, expected) &&
  expected.every(key => value[key] === false);
const blocked = () => Object.freeze({
  state:'blocked',structurallyLinked:0,publicClocked:0,anonymousMinuteOverlaps:0,
  missingPublicClocks:0,officialSpotAnchors:0,independentlyEligiblePrivateRows:0,
  m3A3Accepted:false,holdoutRead:false
});

export function inspectM3SourceCrosschecks(graph, clocks, anchors) {
  if (!plain(graph) || !plain(clocks) || !plain(anchors) ||
      graph.kind !== 'M3_FIVE_SEASON_SCORE_FREE_ANONYMOUS_FIXTURE_CORRESPONDENCE' ||
      clocks.kind !== 'M3_FIVE_CC0_PUBLIC_RETROSPECTIVE_UTC_MINUTE_HISTOGRAM' ||
      anchors.kind !== 'M3_TWO_MISSING_CC0_SEASONS_SIX_OFFICIAL_RFS_AGGREGATE_ANCHORS' ||
      graph.schemaVersion !== 1 || clocks.schemaVersion !== 1 ||
      anchors.schemaVersion !== 1 || graph.observedOn !== '2026-11-10' ||
      clocks.observedOn !== '2026-11-10' || anchors.observedOn !== '2026-11-10' ||
      !denied(graph.limitations, GRAPH_DENIALS) ||
      !denied(clocks.limitations, CLOCK_DENIALS) ||
      !denied(anchors.limitations, RFS_DENIALS)) return blocked();

  if (!Array.isArray(graph.seasons) || graph.seasons.length !== 5 ||
      !Array.isArray(graph.sourceFiles) || graph.sourceFiles.length !== 5 ||
      !Array.isArray(clocks.sourceRows) || clocks.sourceRows.length !== 5 ||
      !Array.isArray(anchors.events) || anchors.events.length !== 6 ||
      !plain(graph.graphTotals) || !plain(graph.gateStatus) ||
      !plain(clocks.aggregate) || !plain(anchors.summary) ||
      !plain(anchors.administrativeResultWarning)) return blocked();

  const g=graph.graphTotals, c=clocks.aggregate, a=anchors.summary;
  if (g.publicFixtureRows !== 1200 || g.privateProviderFinishedRows !== 1200 ||
      g.initialReciprocalSeedSingletons !== 1063 ||
      g.initialAmbiguousPublicFixtures !== 137 ||
      g.postConsistencyResolvedPublicFixtures !== 1200 ||
      g.postConsistencyUnresolvedPublicFixtures !== 0 ||
      g.postConsistencyUnresolvedPrivateFixtures !== 0 ||
      g.postLinkScoreDisagreements !== 0 ||
      g.independentlyCertifiedEligiblePrivateRows !== 0 ||
      graph.gateStatus.m3AcceptedCriteria !== 2 ||
      graph.gateStatus.m3ExitCriteria !== 8 ||
      graph.gateStatus.m3A3Accepted !== false ||
      graph.gateStatus.realM3TrainingAuthorized !== false ||
      graph.gateStatus.holdout2025_26Read !== false ||
      graph.gateStatus.productionForecastChanged !== false ||
      c.publicFixtureRows !== 1200 || c.privateProviderFinishedRows !== 1200 ||
      c.publicClockedRows !== 1153 || c.publicWithoutClock !== 47 ||
      c.exactUtcMinuteOverlapCount !== 1116 ||
      c.publicClockedRowsNotOverlapping !== 37 ||
      c.privateRowsNotOverlapping !== 84 ||
      c.minuteHistogramL1 !== 121 ||
      c.independentlyCertifiedFixtureKickoffs !== 0 ||
      a.events !== 6 || a.season2021_22Events !== 3 ||
      a.season2022_23Events !== 3 ||
      a.uniqueDayMaskDirectionCandidates !== 6 ||
      a.exactUtcMinuteCandidates !== 6 || a.officialScoreAgreements !== 6 ||
      a.publicRevisedOfficialResultsAmongEvents !== 1 ||
      a.independentlyCertifiedPrivatePlayedRows !== 0) return blocked();

  let seeds=0,ambiguous=0,linked=0,clocked=0,missing=0,minute=0,l1=0;
  for (let i=0;i<YEARS.length;i++) {
    const season=YEARS[i], gr=graph.seasons[i], src=graph.sourceFiles[i],
      cr=clocks.sourceRows[i];
    if (!plain(gr) || !plain(src) || !plain(cr) ||
        gr.season !== season || src.season !== season || cr.season !== season ||
        src.blobSha !== cr.pinnedPublicBlob || src.repository !== cr.publisherRepo ||
        gr.publicFixtures !== 240 || gr.privateProviderFinishedFixtures !== 240 ||
        gr.unmatchedByDateMaskDirection !== 0 ||
        gr.postConsistencyResolved !== 240 ||
        gr.postConsistencyUnresolvedPublic !== 0 ||
        gr.postConsistencyUnresolvedPrivate !== 0 ||
        gr.postLinkScoreDisagreements !== 0 ||
        gr.certifiedPlayedGoalPrivateRows !== 0 ||
        gr.reciprocalSeedSingletons + gr.initialAmbiguous !== 240 ||
        cr.publicFixtureRows !== 240 || cr.privateProviderFinishedRows !== 240 ||
        cr.conversionAssumption !== 'Europe/Moscow_LOCAL_TO_UTC' ||
        cr.originalSourceTimeZoneIndependentlyVerified !== false ||
        cr.sourceFirstPublicationVerified !== false ||
        cr.actualOnFieldKickoffVerified !== false ||
        cr.privateFixtureIdentityVerified !== false ||
        cr.publicClockedRows + cr.publicWithoutClock !== 240 ||
        cr.exactUtcMinuteOverlapCount > cr.publicClockedRows ||
        cr.exactUtcMinuteOverlapCount > cr.privateProviderFinishedRows ||
        cr.utcMinuteHistogramL1 !==
          cr.publicClockedRows + cr.privateProviderFinishedRows -
          2*cr.exactUtcMinuteOverlapCount) return blocked();
    seeds+=gr.reciprocalSeedSingletons;
    ambiguous+=gr.initialAmbiguous;
    linked+=gr.postConsistencyResolved;
    clocked+=cr.publicClockedRows;
    missing+=cr.publicWithoutClock;
    minute+=cr.exactUtcMinuteOverlapCount;
    l1+=cr.utcMinuteHistogramL1;
  }
  if (seeds !== 1063 || ambiguous !== 137 || linked !== 1200 ||
      clocked !== 1153 || missing !== 47 || minute !== 1116 || l1 !== 121)
    return blocked();

  const years=new Map([['2021/22',0],['2022/23',0]]);
  let revised=0;
  for (const event of anchors.events) {
    if (!plain(event) || !years.has(event.season) ||
        event.maskDirectionDayCandidates !== 1 ||
        event.exactMinuteCandidates !== 1 ||
        event.exactMinuteOfficialScoreAgreements !== 1 ||
        typeof event.scheduledUtcFromMoscow !== 'string' ||
        !/^20(21|22|23)-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(event.scheduledUtcFromMoscow) ||
        typeof event.officialResultRevisedAfterPlay !== 'boolean') return blocked();
    years.set(event.season, years.get(event.season)+1);
    if (event.officialResultRevisedAfterPlay) revised++;
  }
  const award=anchors.administrativeResultWarning;
  if (years.get('2021/22')!==3 || years.get('2022/23')!==3 || revised!==1 ||
      award.eventCode!=='pari_torpedo_revised_2023' ||
      award.onFieldHomeGoals!==1 || award.onFieldAwayGoals!==1 ||
      award.laterOfficialHomeGoals!==0 || award.laterOfficialAwayGoals!==3 ||
      award.privateRowCertifiedPlayedScore!==false ||
      award.privateProviderOnFieldGoalsVerified!==false) return blocked();

  return Object.freeze({
    state:'corroborated',structurallyLinked:linked,publicClocked:clocked,
    anonymousMinuteOverlaps:minute,missingPublicClocks:missing,
    officialSpotAnchors:6,independentlyEligiblePrivateRows:0,
    m3A3Accepted:false,holdoutRead:false
  });
}
