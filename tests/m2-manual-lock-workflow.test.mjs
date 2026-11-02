import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const wf=readFileSync('.github/workflows/m2-manual-research-lock.yml','utf8');
const runner=readFileSync('ml/src/football_forecast/research/runner.py','utf8');

test('M2 research dispatch is main-owner-only and never automatic',()=>{
  assert.match(wf,/^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(wf,/^\s{2}(push|pull_request|schedule|workflow_run):/m);
  for(const gate of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.confirmation == 'LOCK_TRAIN_ONLY'"
  ]) assert.ok(wf.includes(gate),gate);
  assert.match(wf,/environment: m1-source-import/);
  assert.match(wf,/permissions: \{contents: read\}/);
  assert.match(wf,/timeout-minutes: 10/);
  assert.match(wf,/persist-credentials: false/);
});

test('M2 research uses pinned verified source, CA and read-only snapshot transaction',()=>{
  assert.match(wf,/sha256sum "\$work\/footbolno\.csv"/);
  assert.match(wf,/actual_sha" == "\$M2_SOURCE_SHA"/);
  assert.match(wf,/807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa/);
  assert.match(wf,/m0-cross-source-fixture-reconcile\.mjs/);
  assert.match(wf,/m1-openfootball-score-gate\.mjs/);
  assert.match(wf,/psycopg\[binary\]==3\.3\.6/);
  assert.match(wf,/rm -rf "\$work"/);
  assert.match(runner,/set transaction isolation level repeatable read read only/);
  assert.match(runner,/prepare_pre_holdout_lock/);
  assert.doesNotMatch(runner,/ff_m2_holdout_rows|ff_forecasts|insert into|update ff_/i);
  assert.doesNotMatch(wf,/upload-artifact|persist-credentials: true/);
});
