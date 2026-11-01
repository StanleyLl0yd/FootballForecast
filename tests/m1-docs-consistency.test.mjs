import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const readme=read('../README.md');
const limitations=read('../docs/KNOWN_LIMITATIONS.md');
const operations=read('../docs/OPERATIONS.md');
const architecture=read('../docs/ARCHITECTURE.md');
const deploy=read('../docs/DEPLOYMENT.md');
const security=read('../SECURITY.md');
const tls=read('../docs/m1-verified-tls.md');
const sourceRegister=read('../docs/DATA_SOURCES.md');
const m0AccuracyProtocol=read('../docs/M0_SOURCE_ACCURACY_PROTOCOL.md');

test('current M1 docs do not claim live RPL database is empty or M1 blocked',()=>{
  assert.match(readme,/M1 OPEN/);
  assert.match(readme,/4 полных снимка по 720 матчей \(2880 записей\)/);
  assert.match(limitations,/2880 private source records/);
  assert.match(limitations,/616/);
  assert.match(architecture,/M0 was accepted 2026-10-29/);
  assert.match(architecture,/M1 is OPEN/);
  assert.match(deploy,/m1_compact_source_observations/);
  assert.match(security,/M0 was accepted on 2026-10-29/);
  for(const doc of [readme,limitations,operations,architecture,deploy,security])
    assert.doesNotMatch(doc,/M0 remains OPEN|M1 stays blocked|The real database is empty/);
});

test('automated sources and absence of trained model/deliveries are consistently disclosed',()=>{
  assert.match(operations,/06:17 and 18:17 UTC/);
  assert.match(operations,/seven allowlisted guarded-source pipeline files/);
  assert.match(tls,/freshness issue #168 are complete/);
  assert.match(operations,/07:43 UTC/);
  assert.match(operations,/Forecast creation.*model training.*remain disabled/);
  assert.match(readme,/Обученных моделей, опубликованных прогнозов и подтверждённой точности пока нет/);
  assert.match(limitations,/model training and live predictions remain disabled/);
});

test('M1 operator instructions do not require an empty public catalog or deny autonomous import',()=>{
  assert.match(operations,/616 rows as of/);
  assert.match(operations,/unchanged by staging itself/);
  assert.doesNotMatch(operations,/unchanged empty public/);
  assert.match(tls,/scheduled with optional manual dispatch/);
  assert.doesNotMatch(tls,/manual-only FootballForecast M1 importer/);
  assert.match(sourceRegister,/current registry contains 20/);
  assert.doesNotMatch(sourceRegister,/M0 #2 remains open/);
});

test('historical M0 source protocol cannot imply M0 is still open or Footbolno unused',()=>{
  assert.match(m0AccuracyProtocol,/Historical M0 research document/);
  assert.match(m0AccuracyProtocol,/M0 is now \*\*ACCEPTED\*\*/);
  assert.match(m0AccuracyProtocol,/M1 remains \*\*OPEN\*\*/);
  assert.doesNotMatch(m0AccuracyProtocol,/keep #2 and M0 OPEN/);
  assert.doesNotMatch(m0AccuracyProtocol,/All M0 providers are inactive and remain unapproved/);
});

// Detect a stale M0-only schema/deployment story after private M1 ingestion.
test('live M1 migration, canonical match and private row counts match documented schema',()=>{
  assert.match(architecture,/six RLS-enabled `ff_private`/);
  assert.match(architecture,/nine RLS-enabled `public\.ff_\*`/);
  assert.match(deploy,/`0001`-`0010`/);
  assert.match(deploy,/20261030092045_m1_compact_source_observations/);
  assert.match(deploy,/2880 protected source records/);
  assert.match(deploy,/583 finished, 33 scheduled/);
  assert.match(limitations,/4 immutable full Footbolno snapshots \/ 2880 private source records/);
  assert.match(limitations,/2 compact byte observations/);
  assert.doesNotMatch(deploy,/The live database is empty/);
  assert.doesNotMatch(limitations,/nine reviewed source-controlled migrations/);
});

test('source register dates and supersedes historical M0 zero-data conclusions',()=>{
  assert.match(sourceRegister,/### Current M1 operations \(verified 2026-11-01\)/);
  assert.match(sourceRegister,/M0 is \*\*ACCEPTED\*\*; M1 is \*\*OPEN\*\*/);
  assert.match(sourceRegister,/616 canonical RPL matches/);
  assert.match(sourceRegister,/2880 private match records/);
  assert.match(sourceRegister,/Archived M0 source-gate criteria/);
  assert.match(sourceRegister,/Archived M0 next decision/);
  assert.doesNotMatch(sourceRegister,/## M0 source gate still open/);
  assert.doesNotMatch(sourceRegister,/Until then: \*\*zero provider adapters active/);
  assert.doesNotMatch(sourceRegister,/All sources remain \*\*unapproved\*\*/);
});

test('live security inventory includes all fifteen protected tables',()=>{
  assert.match(security,/All \*\*15\*\* Supabase tables have RLS/);
  assert.match(security,/nine `public\.ff_\*` tables and six `ff_private` tables/);
  assert.match(security,/Neither `anon` nor `authenticated` has table write privileges/);
  assert.match(security,/ff_private\.ff_is_authorized\(\)/);
  assert.doesNotMatch(security,/All nine Supabase `ff_\*` tables have RLS/);
});
