import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM3Topology} from '../lib/m3-source-topology-evidence.mjs';

const load=name=>JSON.parse(readFileSync(new URL('../../../docs/'+name,import.meta.url)));
const reference=[
 load('M3_PUBLIC_SEVEN_SEASON_CLUB_ROSTERS_EVIDENCE.json'),
 load('M3_SEVEN_SEASON_MEMBERSHIP_SIGNATURE_EVIDENCE.json'),
 load('M3_PRIVATE_CALENDAR_MASK_TRIAGE_EVIDENCE.json'),
 load('M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json')
];
const read=()=>structuredClone(reference);

test('M3 all-profile and eight calendar-day patterns corroborated without real eligibility',()=>{
  const result=inspectM3Topology(...read());
  assert.equal(result.state,'corroborated');
  assert.equal(result.verifiedProfileGroups,16);
  assert.equal(result.calendarDayCandidates,8);
  assert.equal(result.singletonProfileClubs,12);
  assert.equal(result.ambiguousProfileClubs,14);
  assert.equal(result.verifiedPrivateIdentityLinks,0);
  assert.equal(result.realTrainingAuthorized,false);
  assert.equal(result.holdoutRead,false);
  assert.ok(Object.isFrozen(result));
});

test('one event mismatch fails closed even if 8/8 aggregate is still claimed',()=>{
  const a=read();
  a[2].events[3].matchingMaskRoleCount=0;
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
test('one event historic day mismatch fails closed',()=>{
  const a=read();
  a[2].events[1].dayUtc='2020-07-02';
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
test('specific all-season-opponent pair is not a private Spartak identity assertion',()=>{
  const a=read();
  a[2].events[6].allSevenSeasonOpponentPairCount=0;
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
test('same global 26 and 82 can still be different seven-season membership groups',()=>{
  const a=read();
  a[1].privateReadOnlyHistogram[0].clubCount=1;
  a[1].privateReadOnlyHistogram.find(x=>x.mask===64).clubCount=3;
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
test('forged aggregate hash or public club alias fails closed',()=>{
  let a=read();
  a[1].aggregateHistogramSha256='0'.repeat(64);
  assert.equal(inspectM3Topology(...a).state,'blocked');
  a=read();
  a[0].seasonReferences[0].publicNameAliasesInFinalTableOrder[0]='false_club';
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
test('all private eligibility, identity and holdout overclaims fail closed',()=>{
  for (const [source,key] of [[1,'realTrainingAuthorized'],
    [1,'privateIdToPublicNameMapped'],[1,'privateProviderIdsExported'],
    [2,'trainingAuthorized'],[2,'officialClubIdentityVerified'],
    [2,'playedGoalStatusVerified'],[2,'holdout2025_26Read']]){
    const a=read();
    a[source].limitations[key]=true;
    assert.equal(inspectM3Topology(...a).state,'blocked',key);
  }
});
test('extra raw-row identifiers and a false eligible-row aggregate fail closed',()=>{
  const a=read();
  a[2].events[0].privateMatchId='forbidden';
  assert.equal(inspectM3Topology(...a).state,'blocked');
  const b=read();
  b[2].aggregate.independentlyEligiblePrivatePlayedRows=8;
  assert.equal(inspectM3Topology(...b).state,'blocked');
});

test('altered independent reference URL and raw private ID field fail closed',()=>{
  let a=read();
  a[2].events[7].publicEvidenceUrl='https://example.org/incorrect-April-match';
  assert.equal(inspectM3Topology(...a).state,'blocked');
  a=read();
  a[1].privateProviderIds=['must never be exported'];
  assert.equal(inspectM3Topology(...a).state,'blocked');
});
