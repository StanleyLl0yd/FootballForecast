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

test('M2 owner-created exact issue command is manual, bounded and default-branch only',()=>{
  const exactCommand='/m2-lock 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f';
  assert.match(wf,/^  issue_comment:\n    types: \[created\]/m);
  for(const gate of [
    "github.event_name == 'issue_comment'",
    "github.event.action == 'created'",
    "github.event.issue.number == 182",
    "!github.event.issue.pull_request",
    "github.event.comment.user.login == 'StanleyLl0yd'",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '"+exactCommand+"'",
    "github.event.comment.body == '/m2-preflight 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f'",
    "github.event.comment.body == '/m2-candidate 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f'",
    "github.actor == 'StanleyLl0yd'",
    "github.ref == 'refs/heads/main'",
    "github.repository == 'StanleyLl0yd/FootballForecast'"
  ]) assert.ok(wf.includes(gate),gate);
  assert.ok(wf.includes("github.event_name == 'issue_comment' && '038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f' || inputs.source_sha256"));
  assert.doesNotMatch(wf,/^\s{2}(pull_request_target|issue_comment_delete|push|schedule|repository_dispatch):/m);
  assert.doesNotMatch(wf,/issues: write|pull-requests: write|contents: write/);
});

test('M2 research uses pinned verified source, CA and read-only snapshot transaction',()=>{
  assert.match(wf,/sha256sum "\$work\/footbolno\.csv"/);
  assert.match(wf,/https:\/\/1\.1\.1\.1\/dns-query\?name=footbolno\.ru&type=A/);
  assert.match(wf,/--resolve "footbolno\.ru:443:\$ip"/);
  assert.match(wf,/address\.is_global/);
  assert.match(wf,/source DNS cardinality refused/);
  assert.match(wf,/actual_sha" == "\$M2_SOURCE_SHA"/);
  assert.match(wf,/807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa/);
  assert.match(wf,/m0-cross-source-fixture-reconcile\.mjs/);
  assert.match(wf,/m1-openfootball-score-gate\.mjs/);
  assert.match(wf,/psycopg\[binary\]==3\.3\.6/);
  assert.match(wf,/inspectM2PreHoldoutLock/);
  assert.match(wf,/M2_LOCK_ATTESTATION_JSON=/);
  assert.match(wf,/M2_LOCK_ATTESTATION_SHA256=/);
  assert.match(wf,/M2_PREFLIGHT: /);
  assert.match(wf,/runner --preflight/);
  assert.match(wf,/runner --candidate/);
  assert.match(wf,/M2_PRIVATE_CANDIDATE_JSON=/);
  assert.match(wf,/preHoldoutLockApproved!==false/);
  assert.match(wf,/M2_PRIVATE_PREFLIGHT_JSON=/);
  assert.match(wf,/externalSourceRechecked!==false/);
  assert.match(wf,/rm -rf "\$work"/);
  assert.match(runner,/set transaction isolation level repeatable read read only/);
  assert.match(runner,/prepare_pre_holdout_lock/);
  assert.doesNotMatch(runner,/ff_m2_holdout_rows|ff_forecasts|insert into|update ff_/i);
  assert.doesNotMatch(wf,/upload-artifact|persist-credentials: true/);
});
