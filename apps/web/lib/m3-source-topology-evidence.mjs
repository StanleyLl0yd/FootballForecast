import {createHash} from 'node:crypto';

export const M3_CALENDAR_MASK_EVENTS = Object.freeze([
  ['orenburg_a','2019/20','2020-06-27','orenburg','home',115,5,1,null],
  ['orenburg_b','2019/20','2020-07-01','orenburg','home',115,6,1,null],
  ['sochi_a','2019/20','2020-07-16','sochi','away',62,4,1,null],
  ['sochi_b','2019/20','2020-07-22','sochi','away',62,8,1,null],
  ['rotor_a','2020/21','2020-09-13','rotor','home',4,3,1,null],
  ['rotor_b','2020/21','2020-09-19','rotor','away',4,2,1,null],
  ['sochi_spartak_a','2023/24','2023-09-16','sochi','either',62,4,1,1],
  ['sochi_spartak_b','2023/24','2024-04-13','sochi','either',62,4,1,1]
]);
const YEARS=['2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'];
const HISTOGRAM_LIMITS=[
  'privateProviderIdsExported','privateFixtureRowsExported','matchGoalsRead',
  'individualClubNamesRead','independentLegalIdentityVerified','privateIdToPublicNameMapped',
  'playedScoreEligibilityProven','historicalKickoffVerified','originalPublicationTimesVerified',
  'sourceTrainingRightsVerified','realTrainingAuthorized','holdout2025_26Read'
];
const EVENT_LIMITS=[
  'privateIdsExported','privateRowsExported','scoreFieldsRead',
  'individualPrivateClubNamesRead','sourceCalendarDatesIndependentlyConvertedToUTC',
  'officialClubIdentityVerified','playedGoalStatusVerified','firstPublicationTimesVerified',
  'sourceRightsVerified','trainingAuthorized','holdout2025_26Read','publicForecastsWritten'
];

const plain=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const keys=(value,expected)=>plain(value) &&
  Object.keys(value).sort().join('|')===expected.slice().sort().join('|');
const allFalse=(value,required)=>keys(value,required) &&
  required.every(key=>value[key]===false);
const deny=()=>Object.freeze({state:'blocked',verifiedProfileGroups:0,calendarDayCandidates:0,
  singletonProfileClubs:0,ambiguousProfileClubs:0,verifiedPrivateIdentityLinks:0,
  realTrainingAuthorized:false,holdoutRead:false});

export function inspectM3Topology(publicRosters,privateMasks,eventEvidence,previousDateEvidence){
  // Pinned public-safe JSON only. The owner's server page must authorize FIRST.
  if (!plain(publicRosters) || !plain(privateMasks) || !plain(eventEvidence) ||
      !plain(previousDateEvidence) ||
      publicRosters.kind!=='M3_PUBLIC_RETROSPECTIVE_SEVEN_SEASON_ROSTER_NAME_CANDIDATE' ||
      privateMasks.kind!=='M3_DEVELOPMENT_ONLY_PRIVATE_TEAM_MEMBERSHIP_HISTOGRAM' ||
      eventEvidence.kind!==
        'M3_AGGREGATE_ONLY_PUBLIC_EVENT_TO_PRIVATE_MEMBERSHIP_MASK_DATE_CANDIDATES' ||
      privateMasks.queryScope && privateMasks.queryScope!==
        'READ_ONLY_SELECT_FF_PRIVATE_SEVEN_DEVELOPMENT_SEASONS') return deny();
  if (privateMasks.scope!=='READ_ONLY_SELECT_FF_PRIVATE_SEVEN_DEVELOPMENT_SEASONS' ||
      eventEvidence.queryScope!==
        'FF_PRIVATE_SEVEN_DEVELOPMENT_SEASONS_SQL_READ_ONLY_UTC_DAY_MASK_COUNTS' ||
      privateMasks.schemaVersion!==1 || eventEvidence.schemaVersion!==1 ||
      privateMasks.observedOn!=='2026-11-09' || eventEvidence.observedOn!=='2026-11-09' ||
      !allFalse(privateMasks.limitations,HISTOGRAM_LIMITS) ||
      !allFalse(eventEvidence.limitations,EVENT_LIMITS) ||
      JSON.stringify(privateMasks.seasonsLeastToMostSignificant)!==JSON.stringify(YEARS)) return deny();

  const byAlias=new Map();
  if (!Array.isArray(publicRosters.seasonReferences) ||
      publicRosters.seasonReferences.length!==7) return deny();
  for (let i=0;i<YEARS.length;i++){
    const roster=publicRosters.seasonReferences[i];
    if (!plain(roster) || roster.season!==YEARS[i] ||
        !Array.isArray(roster.publicNameAliasesInFinalTableOrder) ||
        roster.publicNameAliasesInFinalTableOrder.length!==16 ||
        new Set(roster.publicNameAliasesInFinalTableOrder).size!==16) return deny();
    for (const club of roster.publicNameAliasesInFinalTableOrder){
      if (typeof club!=='string' || !/^[a-z][a-z0-9_]{1,60}$/.test(club)) return deny();
      byAlias.set(club,(byAlias.get(club)||0)|(1<<i));
    }
  }
  if (byAlias.size!==26 || !Array.isArray(privateMasks.privateReadOnlyHistogram)) return deny();
  const counted=new Map();
  for (const mask of byAlias.values()) counted.set(mask,(counted.get(mask)||0)+1);
  const groups=[...counted].sort((a,b)=>a[0]-b[0]);
  const observed=privateMasks.privateReadOnlyHistogram;
  const pairs=[];
  for (const row of observed){
    if (!keys(row,['mask','clubCount']) ||
        !Number.isInteger(row.mask) || row.mask<1 || row.mask>127 ||
        !Number.isInteger(row.clubCount) || row.clubCount<1 || row.clubCount>26) return deny();
    pairs.push([row.mask,row.clubCount]);
  }
  if (JSON.stringify(groups)!==JSON.stringify(pairs)) return deny();
  const digest=createHash('sha256').update(JSON.stringify(pairs)).digest('hex');
  if (digest!==privateMasks.aggregateHistogramSha256 ||
      digest!=='281046ee181a3a404de4860125ce98c974a43c9e0aa20e0e66115279a0768add' ||
      counted.size!==16 || counted.get(127)!==8) return deny();
  const singleton=[...counted.values()].filter(n=>n===1).length;
  if (singleton!==12 || [...counted.values()].reduce((a,b)=>a+b,0)!==26 ||
      !plain(privateMasks.aggregate) ||
      privateMasks.aggregate.privateProviderClubCount!==26 ||
      privateMasks.aggregate.privateClubSeasonAppearances!==112 ||
      privateMasks.aggregate.distinctMembershipProfiles!==16 ||
      privateMasks.aggregate.singletonProfileClubs!==12 ||
      privateMasks.aggregate.ambiguousProfileClubs!==14 ||
      privateMasks.aggregate.adjacentOverlapTotal!==82) return deny();

  const prior=previousDateEvidence.publicAnomalyDayCalendarCandidateCounts;
  if (!Array.isArray(prior) || !Array.isArray(eventEvidence.events) ||
      eventEvidence.events.length!==M3_CALENDAR_MASK_EVENTS.length) return deny();
  const past=new Map(prior.map(row=>[row.day,row.privateMatchesOnSameUtcDay]));
  for (let i=0;i<M3_CALENDAR_MASK_EVENTS.length;i++){
    const [key,season,day,alias,role,mask,dayN,matched,pair]=M3_CALENDAR_MASK_EVENTS[i];
    const row=eventEvidence.events[i];
    if (!keys(row,['eventKey','season','dayUtc','publicClubAlias','publicRole',
      'publicSevenSeasonMask','privateMatchesOnSameUtcDay','matchingMaskRoleCount',
      'allSevenSeasonOpponentPairCount','publicEvidenceUrl']) ||
      row.eventKey!==key || row.season!==season || row.dayUtc!==day ||
      row.publicClubAlias!==alias || row.publicRole!==role ||
      row.publicSevenSeasonMask!==mask || byAlias.get(alias)!==mask ||
      counted.get(mask)!==1 || row.privateMatchesOnSameUtcDay!==dayN ||
      past.get(day)!==dayN || row.matchingMaskRoleCount!==matched ||
      row.allSevenSeasonOpponentPairCount!==pair ||
      typeof row.publicEvidenceUrl!=='string' ||
      !row.publicEvidenceUrl.startsWith('https://')) return deny();
  }
  const summary=eventEvidence.aggregate;
  if (!keys(summary,['publicEventsChecked','anonymousMembershipAndRoleMatches',
    'publicSingletonClubAliasesInEventSet','allSevenSeasonOpponentPairCandidates',
    'independentlyVerifiedPrivateClubLinks','independentlyEligiblePrivatePlayedRows']) ||
    summary.publicEventsChecked!==8 || summary.anonymousMembershipAndRoleMatches!==8 ||
    summary.publicSingletonClubAliasesInEventSet!==3 ||
    summary.allSevenSeasonOpponentPairCandidates!==2 ||
    summary.independentlyVerifiedPrivateClubLinks!==0 ||
    summary.independentlyEligiblePrivatePlayedRows!==0) return deny();

  return Object.freeze({state:'corroborated',verifiedProfileGroups:16,
    calendarDayCandidates:8,singletonProfileClubs:12,ambiguousProfileClubs:14,
    verifiedPrivateIdentityLinks:0,realTrainingAuthorized:false,holdoutRead:false});
}
