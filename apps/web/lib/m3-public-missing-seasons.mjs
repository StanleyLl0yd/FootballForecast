/** Validate pinned PUBLIC-ONLY 2021/22 and 2022/23 goal totals, not match identity.
 * No network, database, filesystem, raw fixtures or model computation.
 */
const sha=/^[a-f0-9]{64}$/;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key));
const root=['schemaVersion','kind','observedOn','scope','sourceFootbolno','seasons','limits'];
const sourceKeys=['sourceUrl','publishedLicenseUrl','publisherDeclaredLicense',
  'snapshotEvidencePath','originalSnapshotReviewedAtUtc','originalSourceSha256',
  'originalSourceBytes','privateOpenFootRightsInferredFromFootbolno',
  'originalOnFieldResultsCertified','historicalFirstPublicationAuthenticated'];
const seasonKeys=['season','footbolnoSourceSeason','rsssfFinalTableUrl',
  'footbolnoFinishedProviderRows','footbolnoClubs','footbolnoUniqueDirectedPairs',
  'footbolnoHomeGoals','footbolnoAwayGoals','rsssfOfficialFinalTableGoalsForSum',
  'knownAdministrativeResultRevision','independentlyCertifiedPrivateMatches'];
const limitKeys=['noPublicRawFixtureRowsRead','noSupabaseDataAccess',
  'totalGoalsEqualityProvesIndividualFixtures','equalGoalsProveUpstreamSourceIndependence',
  'publishedLicenseEstablishesPrivateOpenFootRights',
  'technicalOrRevisedOfficialScoresProvenPlayed','historicalAsOfVerified',
  'privateTeamIdentityIndependentlyCertified','modelTrainingAuthorized','heldout2025_26Read'];
const expected=[
  ['2021/22','2021/2022','https://www.rsssf.org/tablesr/rus2022.html',359,280,639,false],
  ['2022/23','2022/2023','https://www.rsssf.org/tablesr/rus2023.html',411,319,730,true]
];
const invalid=()=>({state:'invalid',seasons:[],publicTotalsAgreementCount:0,
  privatelyCertifiedMatches:0,realTrainingAuthorized:false});

/**
 * A published historical source total is NOT a certificate of played goals.
 * Explicitly reject all positive downstream eligibility assertions.
 * @param {unknown} evidence
 */
export function inspectM3MissingCc0PublicTotals(evidence){
  try{
    if(!exact(evidence,root))return invalid();
    const d=evidence;
    if(d.schemaVersion!==1||d.kind!=='M3_A3_TWO_MISSING_CC0_SEASONS_PUBLIC_GOAL_TOTALS'||
       d.observedOn!=='2026-11-10'||
       d.scope!=='EXISTING_PINNED_PUBLIC_AGGREGATES_ONLY_NO_FETCH_NO_PRIVATE_ACCESS')
      return invalid();
    const f=d.sourceFootbolno;
    if(!exact(f,sourceKeys)||
       f.sourceUrl!=='https://footbolno.ru/data/league/235-matches.csv'||
       f.publishedLicenseUrl!=='https://footbolno.ru/otkrytye-dannye'||
       f.publisherDeclaredLicense!=='CC-BY-4.0-ATTRIBUTION'||
       f.snapshotEvidencePath!=='docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json'||
       f.originalSnapshotReviewedAtUtc!=='2026-10-20T08:08:30Z'||
       typeof f.originalSourceSha256!=='string'||!sha.test(f.originalSourceSha256)||
       f.originalSourceSha256!==
         'dab9b30d69d2c2f7fe2fcadde2aff636552362c08ed7eaa9fe1191d19513c214'||
       f.originalSourceBytes!==542363||
       f.privateOpenFootRightsInferredFromFootbolno!==false||
       f.originalOnFieldResultsCertified!==false||
       f.historicalFirstPublicationAuthenticated!==false)return invalid();
    if(!Array.isArray(d.seasons)||d.seasons.length!==2)return invalid();
    for(let i=0;i<2;i++){
      const y=d.seasons[i],e=expected[i];
      if(!exact(y,seasonKeys)||y.season!==e[0]||y.footbolnoSourceSeason!==e[1]||
         y.rsssfFinalTableUrl!==e[2]||
         y.footbolnoFinishedProviderRows!==240||y.footbolnoClubs!==16||
         y.footbolnoUniqueDirectedPairs!==240||
         y.footbolnoHomeGoals!==e[3]||y.footbolnoAwayGoals!==e[4]||
         y.rsssfOfficialFinalTableGoalsForSum!==e[5]||
         y.footbolnoHomeGoals+y.footbolnoAwayGoals!==y.rsssfOfficialFinalTableGoalsForSum||
         y.knownAdministrativeResultRevision!==e[6]||
         y.independentlyCertifiedPrivateMatches!==0)return invalid();
    }
    if(!exact(d.limits,limitKeys)||
       d.limits.noPublicRawFixtureRowsRead!==true||d.limits.noSupabaseDataAccess!==true||
       limitKeys.slice(2).some(k=>d.limits[k]!==false))return invalid();
    return {state:'public_aggregate_concordance_unapproved',
      seasons:d.seasons.map(y=>({season:y.season,finishedRows:y.footbolnoFinishedProviderRows,
        publicGoals:y.rsssfOfficialFinalTableGoalsForSum,revisionCaveat:
          y.knownAdministrativeResultRevision})),
      publicTotalsAgreementCount:2,privatelyCertifiedMatches:0,realTrainingAuthorized:false};
  }catch{
    return invalid();
  }
}
