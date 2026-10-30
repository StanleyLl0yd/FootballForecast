import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const workflow=readFileSync(new URL('../.github/workflows/m1-private-stage-import.yml',import.meta.url),'utf8');
const current=readFileSync(new URL('../.github/workflows/m1-footbolno-dataset.yml',import.meta.url),'utf8');

test('only main gets scheduled and source-controlled protected import; manual dispatch requires confirmation',()=>{
  assert.match(workflow,/^on:\n  schedule:/m);
  assert.match(workflow,/cron: '17 6,18 \* \* \*'/);
  assert.match(workflow,/^  push:\n    branches: \[main\]/m);
  assert.match(workflow,/paths: \['\.github\/workflows\/m1-private-stage-import\.yml'\]/);
  assert.match(workflow,/^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow,/^  (?:pull_request|workflow_run):/m);
  assert.match(workflow,/if: github\.ref == 'refs\/heads\/main' && \(github\.event_name == 'schedule'/);
  assert.match(workflow,/github\.event_name == 'push'/);
  assert.match(workflow,/github\.event_name == 'workflow_dispatch' && inputs\.confirmation == 'STAGE_FOOTBOLNO_PRIVATE'/);
  assert.match(workflow,/environment: m1-source-import/);
  assert.match(workflow,/cancel-in-progress: false/);
  assert.match(workflow,/permissions:\n  contents: read/);
});

test('privileged database credentials are restricted to the write step',()=>{
  const index=workflow.indexOf('      - name: Validate live source then stage into protected PostgreSQL');
  assert.ok(index>0);
  const preceding=workflow.slice(0,index);
  assert.doesNotMatch(preceding,/\$\{\{ secrets\./);
  const finalStep=workflow.slice(index);
  for(const name of [
    'PGHOST','PGUSER','PGDATABASE','PGPASSWORD','PGROOTCERT_B64'
  ])assert.ok(finalStep.includes('secrets.M1_'+name));
  assert.match(finalStep,/PGSSLMODE: verify-full/);
  assert.match(finalStep,/FF_M1_DB_WRITE_ENABLED: '1'/);
  assert.match(finalStep,/export PGSSLROOTCERT=/);
  assert.doesNotMatch(workflow,/(?:upload-artifact|actions\/cache|save-state|curl\s+.*PGPASSWORD)/);
  assert.doesNotMatch(workflow,/::(?:add-mask|set-output)::/);
});

test('source access uses bounded fixed HTTPS URLs and no model training',()=>{
  assert.match(workflow,/--max-filesize 2000000/);
  assert.match(workflow,/https:\/\/footbolno\.ru\/data\/league\/235-matches\.csv/);
  assert.match(workflow,/scripts\/m1-footbolno-normalize\.mjs/);
  assert.match(workflow,/scripts\/m1-stage-import\.mjs/);
  assert.match(workflow,/rpl-2024-2025\.jsonl/);
  assert.match(workflow,/rpl-2025-2026\.jsonl/);
  assert.match(workflow,/rpl-2026-2027\.jsonl/);
  assert.match(workflow,/--commit/);
  assert.match(workflow,/trap 'rm -rf "\$work"' EXIT/);
  assert.doesNotMatch(workflow,/\b(?:train|predict|supabase auth login)\b/i);
  assert.match(current,/^\s*private-source-snapshot:/m);
});

test('pinned OpenFootball score and directed-fixture gate precedes privileged import',()=>{
  const cross=workflow.indexOf('scripts/m0-cross-source-fixture-reconcile.mjs');
  const gate=workflow.indexOf('scripts/m1-openfootball-score-gate.mjs');
  const commit=workflow.indexOf('"$work/private/rpl-2026-2027.jsonl" --commit');
  assert.ok(cross>0&&gate>cross&&commit>gate);
  assert.match(workflow,/openfootball\/europe\/63df627f3c87ce71708f016522ea236cf74332c3\/russia\/2024-25_ru1\.txt/);
  assert.match(workflow,/--max-filesize 200000/);
  assert.match(workflow,/score-gate\.json/);
  assert.doesNotMatch(workflow,/upload-artifact/);
});

test('Supabase pooler TLS uses pinned CA, validated before secrets and again before import',()=>{
  const ca=readFileSync(new URL('../security/certs/supabase-root-2021-ca.crt',import.meta.url),'utf8');
  assert.ok(ca.startsWith('-----BEGIN CERTIFICATE-----'));
  assert.ok(ca.trimEnd().endsWith('-----END CERTIFICATE-----'));
  const pre=workflow.indexOf('Verify pinned Supabase root CA before secrets are exposed');
  const live=workflow.indexOf('Validate live source then stage into protected PostgreSQL');
  assert.ok(pre>0&&live>pre);
  const fingerprint='807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';
  const parsed=new X509Certificate(ca);
  assert.equal(parsed.fingerprint256.replaceAll(':','').toLowerCase(),fingerprint);
  assert.equal(parsed.ca,true);
  assert.ok(Date.parse(parsed.validTo)>Date.now()+86400000);
  assert.equal(workflow.split(fingerprint).length-1,2);
  for(const required of [
    'openssl x509 -in "$ca" -outform DER | sha256sum',
    'cp security/certs/supabase-root-2021-ca.crt "$work/ca.crt"',
    'export PGSSLROOTCERT="$work/ca.crt"',
    'openssl x509 -in "$work/ca.crt" -noout -checkend 86400',
    'PGSSLMODE: verify-full'
  ])assert.ok(workflow.includes(required),required);
  assert.ok(!workflow.includes('PGSSLROOTCERT=system'));
  assert.ok(!workflow.includes('PGSSLMODE: require'));
  assert.ok(!workflow.includes('PGSSLMODE: disable'));
});

test('private committed snapshots receive aggregate drift review before any guarded current refresh',()=>{
  const commit=workflow.indexOf('"$work/private/rpl-2026-2027.jsonl" --commit');
  const review=workflow.indexOf('ff_private.ff_preview_footbolno_revision(s.id)');
  const report=workflow.indexOf('scripts/m1-revision-report.mjs "$work/private/revision.json"');
  assert.ok(commit>0 && review>commit && report>review);
  assert.match(workflow,/src.name='Footbolno'/);
  assert.match(workflow,/s.source_sha256='\$hash'/);
  assert.match(workflow,/psql -X -qAt -v ON_ERROR_STOP=1/);
  assert.match(workflow,/revision-summary.json/);
  assert.match(workflow,/GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(workflow,/ff_promote_footbolno_snapshot|ff_refresh_footbolno_snapshot/);
  assert.doesNotMatch(workflow,/upload-artifact/);
});

test('only reviewed safe current fixtures can trigger a private write, after staging',()=>{
  const commit=workflow.indexOf('"$work/private/rpl-2026-2027.jsonl" --commit');
  const triage=workflow.indexOf('scripts/m1-autonomous-refresh.mjs decision');
  const guarded=workflow.indexOf('ff_private.ff_apply_safe_current_refresh(s.id)');
  const report=workflow.indexOf('scripts/m1-autonomous-refresh.mjs outcome');
  assert.ok(commit>0&&triage>commit&&guarded>triage&&report>guarded);
  assert.match(workflow,/SAFE_CURRENT_ONLY\)/);
  assert.match(workflow,/REVIEW_REQUIRED\)/);
  assert.match(workflow,/NO_CHANGE\)/);
  assert.match(workflow,/outcome":"PRIVATE_REVIEW_REQUIRED"/);
  assert.match(workflow,/outcome":"UNCHANGED"/);
  assert.match(workflow,/FF_M1_DB_WRITE_ENABLED: '1'/);
  assert.doesNotMatch(workflow,/upload-artifact/);
});
