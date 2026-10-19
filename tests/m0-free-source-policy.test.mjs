import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const registry = JSON.parse(readFileSync(new URL('../docs/M0_FREE_SOURCE_REGISTRY.json', import.meta.url),'utf8'));
const required = [
  'rfs-official','rpl-official','club-official','openfootball-europe','footbolno',
  'sportscore','api-football-free','rsssf','championat','sportbox',
  'wikidata','wikipedia','rusfootball','football-data-uk',
  'thesportsdb-free','footystats-website'
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

test('all 16 known source classes are retained with stable unique IDs and evidence',()=>{
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
  assert.equal(byId['football-data-uk'].access,'restricted-reference');
  assert.equal(byId['thesportsdb-free'].access,'restricted-reference');
  assert.match(byId.sportscore.limitations,/link/);
  assert.match(byId.footbolno.limitations,/upstream license/);
});
