import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const workflow=readFileSync('.github/workflows/m2-openfootball-train-only.yml','utf8');
const secretFreeTrain=workflow.split('  calendar-escrow:')[0];
const legacy=readFileSync('.github/workflows/m1-private-stage-import.yml','utf8');
const dataset=readFileSync('.github/workflows/m1-footbolno-dataset.yml','utf8');
test('manual new source train-only is owner-only, main-only, no secrets or holdout',()=>{
  for(const line of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.confirmation == 'OPENFOOTBALL_TRAIN_ONLY'",
    "github.event.issue.number == 182",
    "github.event.comment.user.login == 'StanleyLl0yd'",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfootball-train-only'",
    'persist-credentials: false','timeout-minutes: 8',
    'permissions: {contents: read}',
    'node scripts/m2-openfootball-training.mjs',
    'football_forecast.research.openfootball_train',
    "github.sha", // weak substring? runner checked with GITHUB_SHA
  ]) if(line!=='github.sha')assert.ok(workflow.includes(line),line);
  assert.match(workflow,/\$GITHUB_SHA/);
  assert.match(workflow,/raw\.githubusercontent\.com\/openfootball\/europe\/63df627f3c87ce71708f016522ea236cf74332c3\/russia\/2024-25_ru1\.txt/);
  assert.match(workflow,/sourceGitBlobSha1/);
  assert.doesNotMatch(secretFreeTrain,/secrets\.|DATABASE_URL|SUPABASE|footbolno\.ru|cron:|^  schedule:|^  push:|upload-artifact|artifact\.zip|holdout_rows|ff_forecasts|psql /im);
});
test('legacy Footbolno network imports are manual only; old rows stay untouched',()=>{
  assert.doesNotMatch(legacy,/^  schedule:|^  push:/m);
  assert.match(legacy,/^  workflow_dispatch:/m);
  assert.match(legacy,/STAGE_FOOTBOLNO_PRIVATE/);
  assert.doesNotMatch(dataset,/^  schedule:/m);
  assert.match(dataset,/^  workflow_dispatch:/m);
  assert.match(dataset,/if: github\.event_name == 'workflow_dispatch'/);
});
