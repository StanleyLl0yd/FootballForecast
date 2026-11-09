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
const backtesting=read('../docs/BACKTESTING.md');
const licensing=read('../docs/LICENSING.md');
const roadmap=read('../ROADMAP.md');
const agents=read('../AGENTS.md');
const changelog=read('../CHANGELOG.md');
const m2Protocol=read('../docs/M2_BASELINE_PROTOCOL.md');

test('accepted M1 docs do not claim live RPL database is empty or M1 blocked',()=>{
  assert.match(readme,/M1 ACCEPTED \(02\.11\.2026\)/);
  assert.match(readme,/4 полных снимка по 720 матчей \(2880 записей\)/);
  assert.match(limitations,/2880 private source records/);
  assert.match(limitations,/616/);
  assert.match(limitations,/four guarded 2026-11-01 final scores/);
  assert.match(limitations,/security issue #165 is closed/);
  assert.doesNotMatch(limitations,/main ruleset hardening #165|three audited 2026-10-31 final scores/);
  assert.match(architecture,/M0 was accepted 2026-10-29/);
  assert.match(architecture,/M1 was accepted 2026-11-02/);
  assert.match(deploy,/m1_compact_source_observations/);
  assert.match(security,/M0 was accepted on 2026-10-29/);
  for(const doc of [readme,limitations,operations,architecture,deploy,security])
    assert.doesNotMatch(doc,/M0 remains OPEN|M1 stays blocked|The real database is empty/);
});

test('accepted M2 preserves sealed-holdout and preregistration boundaries',()=>{
  assert.match(roadmap,/M2 - Statistical Baselines \(ACCEPTED 2026-11-09/);
  assert.match(m2Protocol,/Protocol version: \`m2-independent-poisson-v1\`/);
  assert.match(m2Protocol,/2025\/26.*sealed/i);
  assert.match(m2Protocol,/No production model, database write or public forecast/);
  assert.match(agents,/M3 OPEN for private development research only/);
  assert.match(roadmap,/M3 - Calibration & Evaluation \(OPEN, owner-authorized 2026-11-09\)/);
  assert.match(agents,/no real protected model fitting, public forecasts/);
  assert.match(operations,/M2 opened 2026-11-02; accepted 2026-11-09/);
});

test('retired automatic Footbolno fetches and absence of production models are disclosed',()=>{
  assert.match(operations,/formerly automatic import\/guarded refresh at 06:17 and 18:17 UTC|formerly automatic.*06:17 and 18:17 UTC|historically ran.*06:17 and 18:17 UTC/);
  assert.match(operations,/disabled as scheduled source operations/);
  assert.match(operations,/specifically allowlisted source pipeline dependency/);
  assert.match(tls,/M1 was \*\*ACCEPTED on 2026-11-02\*\*/);
  assert.match(operations,/07:43 UTC/);
  assert.match(operations,/only explicit confirmed manual dispatch is enabled/);
  assert.match(operations,/Forecast publication.*approved production models.*remain disabled/);
  assert.match(readme,/Утверждённых и опубликованных моделей, прогнозов и подтверждённой точности пока нет/);
  assert.match(limitations,/production model training, approved model locking and live predictions remain disabled/);
});

test('M1 operator instructions keep historical data and preserve manual-only recovery',()=>{
  assert.match(operations,/616 rows as of/);
  assert.match(operations,/unchanged by staging itself/);
  assert.doesNotMatch(operations,/unchanged empty public/);
  assert.match(tls,/historically scheduled with optional manual dispatch, now manual-only since 2026-11-03/);
  assert.doesNotMatch(tls,/manual-only FootballForecast M1 importer/);
  assert.match(sourceRegister,/current registry contains 20/);
  assert.doesNotMatch(sourceRegister,/M0 #2 remains open/);
});

test('historical M0 source protocol cannot imply M0 is still open or Footbolno unused',()=>{
  assert.match(m0AccuracyProtocol,/Historical M0 research document/);
  assert.match(m0AccuracyProtocol,/M0 and M1 are now \*\*ACCEPTED\*\*/);
  assert.doesNotMatch(m0AccuracyProtocol,/keep #2 and M0 OPEN/);
  assert.doesNotMatch(m0AccuracyProtocol,/All M0 providers are inactive and remain unapproved/);
});

test('M1 backtesting and licensing distinguish historical M0 research from live protected ingestion',()=>{
  assert.match(backtesting,/M0 was ACCEPTED on 2026-10-29/);
  assert.match(backtesting,/M1 #124\]\(https:\/\/github\.com\/StanleyLl0yd\/FootballForecast\/issues\/124\) was ACCEPTED on 2026-11-02/);
  assert.match(backtesting,/two protected source-offline temporary train-only fits completed/);
  assert.doesNotMatch(backtesting,/M0 remains OPEN|no provider is approved or data imported/);
  assert.match(licensing,/protected M1 Footbolno CC BY 4\.0 importer became operational/);
  assert.match(licensing,/Approved production model training, sealed-holdout evaluation and public forecasts remain disabled/);
  assert.doesNotMatch(licensing,/No provider is activated for production ingestion or ML training in M0/);
});

test('accepted M1 milestone is consistently represented in current operational surfaces',()=>{
  assert.match(roadmap,/M1 — RPL data foundation \(ACCEPTED 2026-11-02\)/);
  assert.match(changelog,/M1 data foundation accepted — 2026-11-02/);
  assert.match(agents,/M1 ACCEPTED 2026-11-02/);
  assert.match(agents,/M2 was OPEN from the 2026-11-02 authorization, ACCEPTED by owner 2026-11-09/);
  assert.match(readme,/M2 ACCEPTED \(09\.11\.2026\)/);
  assert.match(limitations,/M1 ACCEPTED on 2026-11-02/);
  assert.match(sourceRegister,/M0, M1 and M2 ACCEPTED/);
  assert.match(deploy,/M1 was accepted on 2026-11-02/);
  assert.match(operations,/M1 accepted on 2026-11-02/);
  assert.match(licensing,/M1 accepted by owner on 2026-11-02/);
  for(const doc of [readme,roadmap,agents,limitations,operations,architecture,backtesting,security,tls,sourceRegister]){
    assert.doesNotMatch(doc,/M1 (?:remains OPEN|is OPEN|OPEN:)|Статус: M1 OPEN/);
  }
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
  assert.match(sourceRegister,/### Accepted M1 operations \(last source snapshot verified 2026-11-01\)/);
  assert.match(sourceRegister,/M2 was opened for bounded research/);
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
