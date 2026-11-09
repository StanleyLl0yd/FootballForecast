// Repository-wide continuity guard: restoring a stale PR base must never
// silently delete the private one-use evaluation implementation or security
// fixes while keeping a green CI run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(path,'utf8');
const mustInclude=(path,needles)=>{
  const source=read(path);
  for(const needle of needles)assert.ok(source.includes(needle),
    'Protected source continuity required: '+path+' contains '+needle);
};

test('first evaluation intent, private runner and immutable DB survive subsequent PRs',()=>{
  mustInclude('docs/M2_FIRST_FIXED_RETRO_STUDY_INTENT.json',[
    'M2_FIRST_FIXED_POISSON_PRIVATE_RETROSPECTIVE_STUDY_INTENT',
    'NON_STRICT_RETROSPECTIVE','UNFETCHED_SEALED'
  ]);
  mustInclude('ml/src/football_forecast/research/football_data_day_only.py',[
    'score_fixed_day_only','parse_russian_2025_csv',
    '_NAME_POLICY_SHA','_FROZEN_MODEL_ARTIFACT'
  ]);
  mustInclude('ml/src/football_forecast/research/football_data_first_run.py',[
    'verified_event','_SQL_CLAIM','connection.commit()','_http("GET")',
    '_SQL_RESULT','oneUseReservationConsumed'
  ]);
  mustInclude('database/migrations/0014_m2_private_one_use_fixed_evaluation.sql',[
    'ff_m2_one_use_study_claims','ff_m2_one_use_study_results',
    'force row level security','prediction_publication_permitted'
  ]);
  mustInclude('database/tests/0023_m2_private_one_use_fixed_evaluation.sql',[
    'ff_m2_one_use_study_claims','ff_m2_one_use_study_results',
    'synthetic_rollback_verified'
  ]);
  mustInclude('.github/workflows/m2-private-first-fixed-evaluation.yml',[
    "github.actor == 'StanleyLl0yd'",
    "github.event.comment.user.id == 131160519",
    '/m2-private-fixed-first-score-2025-26',
    'environment: m1-source-import',
    'persist-credentials: false'
  ]);
  mustInclude('scripts/m2-private-first-fixed-eval-run.sh',[
    'PGSSLROOTCERT','M2_PRIVATE_FIRST_SCORE_RECEIPT_SHA256'
  ]);
  mustInclude('ml/tests/test_football_data_first_run.py',[
    'test_commit_immutable_claim_before_first_label_read'
  ]);
  mustInclude('ml/tests/test_football_data_day_only.py',[
    'test_fixed_model_metrics_are_deterministic_and_182_58'
  ]);
});

test('provider-independent club mapping, CI migration and backup integrity survive',()=>{
  mustInclude('ml/src/football_forecast/research/openfootball_crosswalk.py',[
    'IndependentRosterPolicy','prepare_provider_independent_name_policy'
  ]);
  mustInclude('ml/tests/test_openfootball_provider_independent.py',[
    'test_fully_different_2025_source_identifiers_bind_without_train_id_reuse'
  ]);
  mustInclude('.github/workflows/ci.yml',[
    '0014_m2_private_one_use_fixed_evaluation.sql',
    '0023_m2_private_one_use_fixed_evaluation.sql'
  ]);
  mustInclude('scripts/m0-isolated-restore-ci.sh',[
    'api.github.com/repos/FiloSottile/age/releases/assets/535541903',
    'sha256sum --check --status'
  ]);
  mustInclude('docs/M2_2025_HOLDOUT_SOURCE_REVIEW.json',[
    'M2_2025_26_HOLDOUT_SOURCE_ELIGIBILITY_REVIEW'
  ]);
  const packageJson=JSON.parse(read('package.json'));
  assert.ok(packageJson.scripts);
  assert.ok(read('apps/web/app/login/page.tsx').includes('M2'));
  assert.ok(read('apps/web/app/setup/page.tsx').includes('M2'));
});

test('owner attestation never replaces the protected score execution chain',()=>{
  mustInclude('apps/web/app/(console)/admin/research/page.tsx',[
    'requireOwner','inspectM2FirstPrivateEvaluation',
    'M2_FIRST_PRIVATE_EVALUATION_EVIDENCE.json'
  ]);
  mustInclude('docs/M2_FIRST_PRIVATE_EVALUATION_EVIDENCE.json',[
    '"bitwiseIndependentReplayPossible": false',
    '"fullSourceBytesArchived": false'
  ]);
  mustInclude('apps/web/tests/m2-first-eval-evidence.test.mjs',[
    'public historical receipt fails closed'
  ]);
});
