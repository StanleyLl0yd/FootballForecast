import {readdirSync,readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const root=new URL('../.github/workflows/',import.meta.url);
const get=name=>readFileSync(new URL(name,root),'utf8');
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
  const workflows=readdirSync(root).filter(name=>name.endsWith('.yml'));
  for(const name of workflows){
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
