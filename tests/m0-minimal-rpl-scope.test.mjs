import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const load = path => JSON.parse(readFileSync(new URL('../docs/' + path, import.meta.url), 'utf8'));
const plan = load('M0_MINIMUM_RPL_SCOPE.json');
const evidence = load('M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
const registry = load('M0_FREE_SOURCE_REGISTRY.json');

test('minimal pilot is strictly two complete past seasons and one current (no early M1)', () => {
  assert.equal(plan.schemaVersion,1);
  assert.equal(plan.milestone,'M0');
  assert.equal(plan.status,'RESEARCH_SCOPE_ONLY_NOT_APPROVED');
  assert.deepEqual(plan.minimumScope.map(s => s.season), [
    '2024/2025','2025/2026','2026/2027'
  ]);
  assert.deepEqual(plan.minimumScope.map(s => s.role), [
    'train_baseline','sealed_holdout','current_live'
  ]);
  assert.equal(plan.minimumScope.filter(s => s.requiredStatus==='completed').length,2);
  assert.equal(plan.noTrainingIfFewerThanTwoCompletedSeasons,true);
  assert.equal(plan.oneCompletedSeasonMode,'catalog_only_not_scored_or_calibrated');
  assert.equal(plan.policy.maxCostUSD,0);
  for(const flag of ['providerIntegrationEnabled','ingestionApproved','trainingApproved',
    'publishingApproved','strictHistoricalAsOfVerified','rightsVerified','recordLevelAccuracyVerified']){
    assert.equal(plan.policy[flag],false,flag);
  }
  assert.equal(registry.policy.activeProviderIntegrations,0);
  assert.ok(registry.sources.every(s => !s.active && !s.authorizedAutomatedTraining));
});

test('minimal scope matches immutable pinned season aggregates, not invented matches', () => {
  assert.equal(plan.evidenceFile,'M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
  assert.match(evidence.sourceSHA256,/^[0-9a-f]{64}$/);
  assert.equal(evidence.providerRightsApproved,false);
  assert.equal(evidence.historicalPrematchAsOfVerified,false);
  assert.equal(evidence.hasRecognizedPerRecordPublishedAtColumn,false);
  const seasons = new Map(evidence.seasons.map(s => [s.season,s]));
  for(const item of plan.minimumScope){
    const observed=seasons.get(item.season);
    assert.ok(observed,'season missing from immutable aggregate: '+item.season);
    assert.equal(item.sourceEvidence,'footbolno');
    assert.equal(item.expectedFixtures,240);
    assert.equal(observed.sourceRows,item.expectedFixtures);
    assert.equal(observed.distinctDirectedPairs,240);
    assert.equal(observed.duplicateDirectedPairs,0);
    assert.equal(observed.duplicateMatchIds,0);
    assert.equal(observed.distinctClubCount,16);
    assert.equal(observed.structuralResearchClassification,'STRUCTURE_ONLY_CANDIDATE');
    assert.equal(observed.statuses.finished,item.expectedFinished??item.expectedFinishedAtSnapshot);
    assert.equal(observed.statuses.scheduled,item.requiredStatus==='completed'?0:item.expectedScheduledAtSnapshot);
  }
});

test('scope cannot be mistaken for calibrated or strict retrospective forecasting',()=>{
  assert.ok(plan.rules.some(s=>s.includes('upstream')));
  assert.ok(plan.rules.some(s=>s.includes('holdout')));
  assert.ok(plan.rules.some(s=>s.includes('M3')));
  assert.ok(plan.rules.some(s=>s.includes('non-strict')));
  assert.ok(plan.rules.some(s=>s.includes('No separate independent validation/calibration cohort')));
  assert.ok(plan.rules.some(s=>s.includes('do not tune on the holdout')));
  assert.ok(plan.rules.some(s=>s.includes('do not')||s.includes('Do not')));
  const roadmap = readFileSync(new URL('../ROADMAP.md', import.meta.url),'utf8');
  assert.match(roadmap,/M0_MINIMUM_RPL_SCOPE\.json/);
  assert.match(roadmap,/M1 - Data Foundation \(BLOCKED/);
  const protocol=readFileSync(new URL('../docs/BACKTESTING.md',import.meta.url),'utf8');
  assert.match(protocol,/2024\/25/);
  assert.match(protocol,/2025\/26/);
  assert.match(protocol,/2026\/27/);
  assert.match(protocol,/no (?:independent )?calibration/i);
});
