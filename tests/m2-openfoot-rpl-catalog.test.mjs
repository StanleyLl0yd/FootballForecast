import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectOpenFootRplCatalog} from '../scripts/m2-openfoot-rpl-catalog.mjs';

const AT='2026-11-03T12:15:00Z';
const doc=()=>({data:[
  {id:'comp_premier_league_eng',currentSeason:'2026/27',availableSeasons:['2026/27'],
    source:{name:'Other',license:'CC0',mode:'current',url:'https://example.org'},coverage:{fixtures:true}},
  {id:'comp_premier_league_rus',currentSeason:'2026/27',availableSeasons:['2026/27'],
    source:{name:'Upstream Public Results',license:'Open Data',mode:'current',
      url:'https://example.org/source'},coverage:{fixtures:true}},
],meta:{count:2}});
const invalid=fn=>{const d=doc();fn(d);
  assert.throws(()=>inspectOpenFootRplCatalog(d,AT),/refused/);};

test('catalog source and licence are isolated, not an upstream-use authorization',()=>{
  const report=inspectOpenFootRplCatalog(doc(),AT);
  assert.equal(report.sourceName,'Upstream Public Results');
  assert.equal(report.sourceLicenseClaim,'Open Data');
  assert.equal(report.sourceUrl,'https://example.org/source');
  assert.equal(report.season2026_27Listed,true);
  assert.equal(report.catalogFixturesFlag,true);
  assert.equal(report.productionIngestionApproved,false);
  assert.equal(report.originalUpstreamRightsIndependentlyVerified,false);
  assert.equal(report.matchResultsCrossChecked,false);
  assert.equal(report.holdoutRead,false);
  assert.equal(report.providerMatchRowsLogged,0);
  assert.doesNotMatch(JSON.stringify(report),/comp_premier_league_eng|Other/);
});
test('missing or duplicated RPL catalog item fails closed',()=>{
  invalid(x=>x.data.pop());
  invalid(x=>x.data.push(structuredClone(x.data[1])));
  invalid(x=>x.data[1].source=null);
  invalid(x=>x.data[1].source.license='');
  invalid(x=>x.data[1].source.name='source\nMASKED');
  invalid(x=>x.data[1].source.url='http://localhost/x');
  invalid(x=>x.data[1].source.url='https://user:pass@example.com/source');
  invalid(x=>x.data[1].source.url='https://example.org/?token=SECRET');
  invalid(x=>x.data[1].source.mode='untrusted');
  invalid(x=>x.data[1].currentSeason=null);
  invalid(x=>x.data[1].availableSeasons='2026/27');
  assert.throws(()=>inspectOpenFootRplCatalog(doc(),'invalid'),/refused/);
});
test('explicitly unavailable catalog status is INCONCLUSIVE even with past fixtures',()=>{
  const d=doc();d.data[1].source.mode='unavailable';
  const report=inspectOpenFootRplCatalog(d,AT);
  assert.equal(report.researchInterpretation,'SOURCE_CATALOG_INCONSISTENT_WITH_OBSERVED_FIXTURES');
  assert.equal(report.productionIngestionApproved,false);
});
test('catalog probe requires owner issue command and private Starter key without leaking data',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const marker='  bounded-openfoot-source-catalog:';
  const index=workflow.indexOf(marker);
  assert.ok(index>0);
  const job=workflow.slice(index);
  for(const expected of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.openfoot_catalog == 'AUDIT_OPENFOOT_CATALOG'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-catalog'",
    "https://openfootapi.com/v1/competitions",
    "scripts/m2-openfoot-rpl-catalog.mjs",
    "--max-redirs 0","persist-credentials: false",
    "M2_OPENFOOT_CATALOG_OBSERVATION=INCONCLUSIVE_HTTP_",
    "INCONCLUSIVE_NO_FREE_KEY","INCONCLUSIVE_KEY_FORMAT",
    "OPENFOOT_API_KEY: ${{ secrets.OPENFOOT_API_KEY }}"
  ])assert.ok(job.includes(expected),expected);
  assert.doesNotMatch(job,/--location|curl -L|upload-artifact|DATABASE_URL|set -x|git push|psql /);
  assert.doesNotMatch(job,/echo[^\n]*\$\{?OPENFOOT_API_KEY/);
  assert.doesNotMatch(workflow,/^  (?:push|schedule|workflow_run):/m);
});

test('real catalog licence claim Unlicensed-Beta is fail-closed for production',()=>{
  const d=doc();
  d.data[1].source.license='Unlicensed-Beta (owner-approved factual data)';
  const report=inspectOpenFootRplCatalog(d,AT);
  assert.equal(report.researchInterpretation,
    'UNLICENSED_UPSTREAM_NOT_APPROVED_FOR_PRODUCTION');
  assert.equal(report.upstreamProductionReuseQualified,false);
  assert.equal(report.productionIngestionApproved,false);
  assert.equal(report.holdoutRead,false);
});
