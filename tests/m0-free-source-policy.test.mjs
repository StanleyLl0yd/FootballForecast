import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';

const registry = JSON.parse(readFileSync(new URL('../docs/M0_FREE_SOURCE_REGISTRY.json', import.meta.url),'utf8'));
const required = [
  'rfs-official','rpl-official','club-official','openfootball-europe','footbolno',
  'sportscore','api-football-free','rsssf','championat','sportbox',
  'wikidata','wikipedia','rusfootball','football-data-uk',
  'thesportsdb-free','footystats-website','understat-public-mirror','open-matchday-rpl',
  'sstats-football-api','uefa-rpl-domestic'
];
const freeModes = new Set([
  'public-reference','public-open-data','documented-free-tier',
  'restricted-personal-research','development-only'
]);
const accessModes = new Set([
  'manual-reference','offline-candidate','free-api-candidate','restricted-reference'
]);

test('the owner rule is strictly zero-cost, without provider billing or fallback',()=>{
  assert.equal(registry.schemaVersion,1);
  assert.equal(registry.policy.maxMonthlySpendUSD,0);
  for(const key of [
    'allowPurchases','allowPaidPlans','allowAutoUpgrade','allowBillingFallback',
    'allowScraping','allowTrainingFromUnapprovedData','allowPublicRedistributionOfUnapprovedData'
  ])assert.equal(registry.policy[key],false,key);
  assert.equal(registry.policy.activeProviderIntegrations,0);
});

test('all 20 known source classes are retained with stable unique IDs and evidence',()=>{
  assert.ok(Array.isArray(registry.sources));
  const ids=registry.sources.map(source=>source.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of required)assert.ok(ids.includes(id),`missing known source: ${id}`);
  for(const source of registry.sources){
    assert.match(source.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(source.url,/^https:\/\/[^\s]+$/);
    assert.ok(typeof source.title==='string'&&source.title.length>4);
    assert.ok(Array.isArray(source.roles)&&source.roles.length);
    assert.ok(Number.isInteger(source.priority)&&source.priority>=1&&source.priority<=4);
    assert.ok(freeModes.has(source.zeroCost),`paid or unknown cost tier for ${source.id}`);
    assert.ok(accessModes.has(source.access),`unknown access mode for ${source.id}`);
    assert.ok(source.rights&&source.qualityEvidence&&source.limitations);
    assert.equal(source.active,false,`${source.id} must not import data while M0 remains open`);
    assert.equal(source.authorizedAutomatedTraining,false);
    assert.equal(source.authorizedRawRepublication,false);
    assert.equal(source.verifiedPrematchSnapshots,false);
    assert.equal(source.verifiedCurrentRPLCoverage,false);
    assert.equal(source.empiricalResultErrorRate,null,
      `${source.id} cannot invent an empirically measured error rate`);
  }
});

test('rankings mean authority/provenance priority, not unsupported claims of percent accuracy',()=>{
  assert.match(registry.policy.rankMeaning,/NOT an empirically measured accuracy score/);
  const byId=Object.fromEntries(registry.sources.map(source=>[source.id,source]));
  assert.equal(byId['rfs-official'].priority,1);
  assert.equal(byId['rpl-official'].priority,1);
  assert.equal(byId['openfootball-europe'].priority,2);
  assert.equal(byId.footbolno.priority,2);
  assert.equal(byId.sportscore.priority,3);
  assert.equal(byId['api-football-free'].priority,3);
  assert.equal(byId.rusfootball.priority,4);
  assert.match(byId['openfootball-europe'].limitations,/2023\/24/);
  assert.match(byId.rusfootball.limitations,/3-0/);
});

test('restricted or development-only sources cannot be treated as production feeds',()=>{
  for(const source of registry.sources){
    if(source.zeroCost==='restricted-personal-research'||source.zeroCost==='development-only'){
      assert.equal(source.access,'restricted-reference');
    }
  }
  const byId=Object.fromEntries(registry.sources.map(source=>[source.id,source]));
  assert.equal(byId['footystats-website'].access,'restricted-reference');
  assert.equal(byId['understat-public-mirror'].access,'restricted-reference');
  assert.equal(byId['open-matchday-rpl'].access,'restricted-reference');
  assert.equal(byId['football-data-uk'].access,'restricted-reference');
  assert.equal(byId['thesportsdb-free'].access,'restricted-reference');
  assert.equal(byId['sstats-football-api'].access,'restricted-reference');
  assert.equal(byId['sstats-football-api'].priority,4);
  assert.equal(byId['sstats-football-api'].zeroCost,'documented-free-tier');
  assert.match(byId['sstats-football-api'].limitations,/Flashscore/);
  assert.equal(byId['sstats-football-api'].authorizedAutomatedTraining,false);
  assert.equal(byId['uefa-rpl-domestic'].access,'manual-reference');
  assert.equal(byId['uefa-rpl-domestic'].priority,3);
  assert.equal(byId['uefa-rpl-domestic'].authorizedAutomatedTraining,false);
  assert.equal(byId['uefa-rpl-domestic'].automatedExtraction,
    'prohibited-for-database-compilation-by-site-terms');
  assert.match(byId.sportscore.rights,/conflict/);
  assert.match(byId.sportscore.limitations,/link/);
  assert.match(byId.footbolno.limitations,/upstream license/);
});

test('official RPL protocols are manual-only because publisher bans automated extraction',()=>{
  const byId=Object.fromEntries(registry.sources.map(item=>[item.id,item]));
  const rpl=byId['rpl-official'];
  assert.equal(rpl.access,'manual-reference');
  assert.equal(rpl.zeroCost,'public-reference');
  assert.equal(rpl.active,false);
  assert.equal(rpl.automatedExtraction,'prohibited-without-official-permission');
  assert.match(rpl.limitations,/expressly prohibits automated extraction/);
  assert.match(rpl.limitations,/official permission/);
  assert.equal(rpl.authorizedAutomatedTraining,false);
  assert.equal(rpl.authorizedRawRepublication,false);
  const license=readFileSync(new URL('../docs/LICENSING.md',import.meta.url),'utf8');
  const docs=readFileSync(new URL('../docs/DATA_SOURCES.md',import.meta.url),'utf8');
  assert.match(license,/official RPL website/);
  assert.match(license,/automated extraction/);
  assert.match(docs,/RPL official-domain extraction restriction/);
  // This repository has no legal permission to issue automated requests to
  // RPL's official domain. Do not ship extraction through scripts or workflows.
  for(const folder of ['scripts','.github/workflows']){
    const root=new URL('../'+folder+'/',import.meta.url);
    for(const filename of readdirSync(root)){
      if(!/\.(?:mjs|js|ts|sh|yml|yaml)$/.test(filename))continue;
      const content=readFileSync(new URL(filename,root),'utf8');
      assert.doesNotMatch(content,/(?:https?:\/\/)?(?:www\.)?premierliga\.ru/i,
        folder+'/'+filename+' must not automate the RPL official domain');
    }
  }
});

test('Footbolno rights clarification is only a draft: no private response or ingestion approval',()=>{
  const doc=readFileSync(new URL('../docs/M0_FOOTBOLNO_RIGHTS_INQUIRY.md',import.meta.url),'utf8');
  const data=readFileSync(new URL('../docs/DATA_SOURCES.md',import.meta.url),'utf8');
  assert.match(doc,/info@footbolno\.ru/);
  assert.match(doc,/НЕ ОТПРАВЛЕН/);
  assert.match(doc,/2024\/25/);
  assert.match(doc,/2025\/26/);
  assert.match(doc,/2026\/27/);
  assert.match(doc,/машинное обучение/i);
  assert.match(doc,/сторонних провайдеров/);
  assert.match(doc,/история правок/);
  assert.match(doc,/UPSTREAM_RIGHTS_UNVERIFIED/);
  assert.match(doc,/NON_STRICT_RETROSPECTIVE/);
  assert.match(data,/M0_FOOTBOLNO_RIGHTS_INQUIRY\.md/);
  assert.equal(registry.policy.activeProviderIntegrations,0);
  assert.equal(registry.sources.find(s=>s.id==='footbolno').authorizedAutomatedTraining,false);
});


test('public source catalog reflects measured historical and current match samples without activating providers',()=>{
  const byId=Object.fromEntries(registry.sources.map(source=>[source.id,source]));
  const reported=JSON.parse(readFileSync(
    new URL('../docs/M0_SPORTSCORE_FILTERED_RPL_EVIDENCE.json',import.meta.url),'utf8'));
  assert.equal(reported.aggregates.matchedDirectedFixtures,16);
  assert.equal(reported.aggregates.finishedFixturesPriorToObservation,8);
  assert.equal(reported.aggregates.scheduledFixturesAtObservation,8);
  assert.equal(reported.aggregates.queryHttp200,6);
  assert.equal(reported.inferences.rightsForModelTrainingVerified,false);
  assert.match(byId['openfootball-europe'].qualityEvidence,/240\/240 directed fixtures/);
  assert.match(byId.footbolno.qualityEvidence,/2024\/25 240\/240/);
  assert.match(byId.footbolno.qualityEvidence,/2025\/26 240\/240/);
  assert.match(byId.footbolno.qualityEvidence,/2026\/27 16\/16/);
  assert.match(byId.wikipedia.qualityEvidence,/1359156694/);
  assert.match(byId.wikipedia.limitations,/lacks kickoff times/);
  assert.match(byId.sportscore.qualityEvidence,/16\/16 directed pair matches/);
  assert.match(byId.sportscore.qualityEvidence,/M0_SPORTSCORE_FILTERED_RPL_EVIDENCE\.json/);
  assert.match(byId.sportscore.limitations,/No verified 2024\/25 training or 2025\/26 complete historical/);
  assert.match(byId.sportscore.qualityEvidence,/unresolved precedence/);
  for(const source of Object.values(byId)){
    assert.equal(source.active,false);
    assert.equal(source.authorizedAutomatedTraining,false);
    assert.equal(source.authorizedRawRepublication,false);
    assert.equal(source.empiricalResultErrorRate,null);
    assert.equal(source.verifiedCurrentRPLCoverage,false);
    assert.equal(source.verifiedPrematchSnapshots,false);
  }
  assert.equal(registry.policy.activeProviderIntegrations,0);
});


test('owner accepts only publisher-documented free source uses, not unverified ETL or bulk rights',()=>{
  assert.equal(registry.policy.ownerApprovedPublishedSourceUse,true);
  assert.equal(registry.policy.ownerApprovalDocument,'M0_EXIT_AUDIT_AND_SOURCE_DECISION.md');
  const byId=Object.fromEntries(registry.sources.map(s=>[s.id,s]));
  const footbolno=byId.footbolno.ownerUsageDecision;
  assert.equal(footbolno.status,'accepted-attributed-publisher-licensed-use');
  assert.ok(footbolno.acceptedUse.includes('bounded-csv-and-json-download'));
  assert.ok(footbolno.acceptedUse.includes('attributed-derived-analytics'));
  assert.equal(footbolno.upstreamRightsIndependentlyVerified,false);
  assert.equal(footbolno.historicalPrematchAsOfVerified,false);
  assert.equal(footbolno.m0ProductionIngestionEnabled,false);
  const sportscore=byId.sportscore.ownerUsageDecision;
  assert.equal(sportscore.status,'accepted-free-attributed-api-use');
  assert.ok(sportscore.acceptedUse.includes('own-response-caching'));
  assert.ok(sportscore.attribution.includes('dofollow'));
  assert.equal(sportscore.historicalTrainingApproved,false);
  assert.equal(sportscore.rawBulkResaleApproved,false);
  assert.equal(sportscore.generalSiteConflictResolved,false);
  assert.equal(sportscore.m0ProductionIngestionEnabled,false);
  assert.equal(byId['openfootball-europe'].ownerUsageDecision.status,
    'accepted-cc0-structural-research-use');
  assert.equal(registry.sources.filter(s=>s.ownerUsageDecision).length,3);
  assert.equal(registry.policy.activeProviderIntegrations,0);
  assert.ok(registry.sources.every(s=>!s.active&&!s.authorizedAutomatedTraining));
  const record=readFileSync(
    new URL('../docs/M0_EXIT_AUDIT_AND_SOURCE_DECISION.md',import.meta.url),'utf8');
  assert.match(record,/two separate full-repository passes/);
  assert.match(record,/Footbolno CC BY 4\.0/);
  assert.match(record,/SportScore/);
  assert.match(record,/M0 remains \*\*OPEN\*\*/);
});

test('all twenty free sources carry owner usage scope independently of adapter state',()=>{
  assert.equal(registry.policy.ownerAuthorizesAllListedFreeSourcesWithinPublishedTerms,true);
  assert.equal(registry.policy.noRoutinePublisherLetterOrUpstreamChainProofGate,true);
  assert.equal(registry.sources.length,20);
  assert.ok(registry.sources.every(s=>s.ownerApprovedUseWithinPublishedTerms===true));
  assert.equal(registry.policy.activeProviderIntegrations,0);
  assert.ok(registry.sources.every(s=>s.active===false));
});
