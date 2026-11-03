import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=name=>JSON.parse(readFileSync(new URL('../docs/'+name,import.meta.url),'utf8'));
const seasons=['2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'];
const groups=['venue','city','pitchSurface','weather','coaches','lineups','players','xg',
  'shots','bookmakerOdds'];
test('pinned owner evidence matches seven historical team identity samples without raw IDs',()=>{
  const e=file('M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json');
  assert.equal(e.kind,'M2_RPL_SEVEN_SEASON_TEAM_IDENTITY_SAMPLE');
  assert.equal(e.ownerRunId,41674569785);
  assert.equal(e.exactMainSha,'6cbdf1c4599708e83d809f1ed7ad787db4b23f2f');
  assert.equal(e.requests,7);
  assert.equal(e.sampleRows,350);
  assert.equal(e.observedUniqueClubIds,26);
  assert.deepEqual(e.perSeason.map(x=>x.season),seasons);
  assert.ok(e.perSeason.every(x=>x.firstPageRows===50&&x.clubIds===16&&
    x.missingNames===0&&x.withinSeasonConflictingNames===0&&x.nameCollisions===0));
  assert.deepEqual(e.consecutiveOverlaps.map(x=>x.sharedIds),[14,14,14,13,14,13]);
  assert.equal(e.totalSharedAdjacentClubIdInstances,82);
  assert.equal(e.totalUnchangedDisplayNameInstances,82);
  for(const row of e.perSeason)for(const k of groups)
    assert.equal(row.presentCandidateFieldRowCounts[k],0,k);
  for(const k of groups)assert.equal(e.featurePresenceCountAcrossAllFirstPages[k],0,k);
  assert.match(e.identityContinuitySha256,/^[a-f0-9]{64}$/);
  assert.match(e.sourcePagesSha256,/^[a-f0-9]{64}$/);
  assert.equal(e.limitations.modelTrainingApproved,false);
  assert.equal(e.limitations.holdoutRead,false);
  assert.equal(e.limitations.independentClubIdentityMappingAccepted,false);
  assert.equal(e.limitations.fullSeasonFeatureAbsenceProven,false);
  const text=JSON.stringify(e);
  assert.doesNotMatch(text,/sourceMatchId|teamId|homeTeamId|awayTeamId|coefficient/);
});
test('feature enrichment matrix is prospective and refuses unproven as-of coverage',()=>{
  const m=file('RPL_SEVEN_SEASON_ENRICHMENT_PLAN.json');
  assert.equal(m.costLimitUSD,0);
  assert.deepEqual(m.developmentSeasons,seasons);
  assert.equal(m.archivedFixtureCoverage.rows,1680);
  assert.equal(m.firstPageSourceRowsChecked,350);
  assert.equal(m.candidateFeatureKeysObservedFirstPageSamples,0);
  assert.ok(m.fieldFamilies.every(x=>x.strictPrematchPotential));
  assert.ok(m.candidateProviders.every(x=>x.historicalRplCoverage.startsWith('UNVERIFIED')));
  assert.equal(m.safety.noPretendHistoricalAsOf,true);
  assert.equal(m.safety.noNewModelTrainingApproval,true);
  assert.equal(m.safety.noSealedHoldoutAccess,true);
  assert.equal(m.safety.noBookmakerSuperiorityClaim,true);
});
