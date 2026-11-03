import {readdirSync,readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=new URL('../.github/workflows/',import.meta.url);
const workflows=Object.freeze({
  'ci.yml':readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8'),
  'codeql.yml':readFileSync(new URL('../.github/workflows/codeql.yml',import.meta.url),'utf8'),
  'm0-footbolno-csv-research.yml':readFileSync(new URL('../.github/workflows/m0-footbolno-csv-research.yml',import.meta.url),'utf8'),
  'm0-footbolno-metadata.yml':readFileSync(new URL('../.github/workflows/m0-footbolno-metadata.yml',import.meta.url),'utf8'),
  'm0-live-rest-denials.yml':readFileSync(new URL('../.github/workflows/m0-live-rest-denials.yml',import.meta.url),'utf8'),
  'm0-sportscore-day-research.yml':readFileSync(new URL('../.github/workflows/m0-sportscore-day-research.yml',import.meta.url),'utf8'),
  'm0-sportscore-filtered-rpl-research.yml':readFileSync(new URL('../.github/workflows/m0-sportscore-filtered-rpl-research.yml',import.meta.url),'utf8'),
  'm1-footbolno-dataset.yml':readFileSync(new URL('../.github/workflows/m1-footbolno-dataset.yml',import.meta.url),'utf8'),
  'm1-private-stage-import.yml':readFileSync(new URL('../.github/workflows/m1-private-stage-import.yml',import.meta.url),'utf8'),
  'm2-manual-research-lock.yml':readFileSync(new URL('../.github/workflows/m2-manual-research-lock.yml',import.meta.url),'utf8'),
  'm2-openfootball-train-only.yml':readFileSync(new URL('../.github/workflows/m2-openfootball-train-only.yml',import.meta.url),'utf8'),
  'm2-public-sources-observe.yml':readFileSync(new URL('../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8'),
  'security.yml':readFileSync(new URL('../.github/workflows/security.yml',import.meta.url),'utf8'),
});
const get=name=>workflows[name];
const legacy=[
  'm0-footbolno-csv-research.yml',
  'm0-footbolno-metadata.yml',
  'm0-sportscore-day-research.yml',
  'm0-sportscore-filtered-rpl-research.yml',
  'm1-private-stage-import.yml',
];

test('legacy Footbolno network jobs cannot be started by push or schedule',()=>{
  for(const name of legacy){
    const source=get(name);
    assert.match(source,/^on:\n(?:  #.*\n)?  workflow_dispatch:/m);
    assert.doesNotMatch(source,/^  (?:push|schedule|pull_request|workflow_run|repository_dispatch):/m);
    assert.match(source,/github\.ref == 'refs\/heads\/main'/);
    assert.match(source,/github\.event_name == 'workflow_dispatch'/);
    if(!name.startsWith('m1-')){
      assert.match(source,/github\.repository == 'StanleyLl0yd\/FootballForecast'/);
      assert.match(source,/github\.actor == 'StanleyLl0yd'/);
      assert.match(source,/permissions: \{contents: read\}/);
      assert.doesNotMatch(source,/secrets\./);
    }else{
      assert.match(source,/STAGE_FOOTBOLNO_PRIVATE/);
      assert.match(source,/environment: m1-source-import/);
    }
  }
});

test('push-triggered M1 unit tests are isolated from optional manual-only publisher downloads',()=>{
  const source=get('m1-footbolno-dataset.yml');
  assert.match(source,/^  push:\n    branches: \[main\]/m);
  assert.match(source,/private-source-snapshot:\n    if: github\.event_name == 'workflow_dispatch'/);
});

test('any workflow with an automatic Footbolno URL requires an explicit network-job gate',()=>{
  assert.deepEqual(readdirSync(root).filter(name=>name.endsWith('.yml')).sort(),
    Object.keys(workflows).sort(), 'new workflows must be explicitly reviewed');
  for(const name of Object.keys(workflows)){
    const source=get(name);
    const accessesSource=source.includes('https://footbolno.ru/')||
      source.includes('footbolno.csv')||
      source.includes('m0-footbolno-metadata.mjs');
    if(!accessesSource)continue;
    const automatic=/^  (?:push|schedule|pull_request|workflow_run|repository_dispatch):/m.test(source);
    if(!automatic)continue;
    assert.equal(name,'m1-footbolno-dataset.yml',
      'New automatically triggered legacy Footbolno workflow must be quarantined: '+name);
    assert.match(source,/private-source-snapshot:\n    if: github\.event_name == 'workflow_dispatch'/);
  }
});
