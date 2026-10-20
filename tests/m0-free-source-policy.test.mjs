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
  'sstats-football-api'
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

test('all 19 known source classes are retained with stable unique IDs and evidence',()=>{
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
