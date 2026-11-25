import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {inspectRecordedM4OwnerStatus} from '../lib/m4-owner-status.mjs';

const snapshot = JSON.parse(readFileSync(new URL('../../../docs/M4_OWNER_AGGREGATE_2026-11-24.json',
  import.meta.url), 'utf8'));

test('dated aggregate is not live verification or authorization', () => {
  const view = inspectRecordedM4OwnerStatus(snapshot);
  assert.ok(view);
  assert.equal(view.recordedDate, '2026-11-24');
  assert.equal(view.gatesAccepted, 5);
  assert.equal(view.forecast + view.abstain, view.shadowEntries);
  assert.equal(view.timeProofs, view.captures);
  for (const flag of ['liveVerified','playedFinalAttested','scoringAuthorized','publicationAuthorized'])
    assert.equal(view[flag], false);
  assert.ok(Object.isFrozen(view));
  assert.equal(view.clubRun,
    'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/45341933790');
  assert.ok(!Object.hasOwn(view, 'clubBatchSha256'));
});

test('modified or extended evidence fails closed', () => {
  for (const patch of [
    {forecast: 8}, {abstain: 0}, {clubBodies: '8'}, {gatesAccepted: 8},
    {clubRunId: 'https://attacker.example'}, {clubBatchSha256: 'a'.repeat(64)},
    {observedDateUtc: '2026-11-25'}, {modelApproved: true},
    {playedFinalAttested: true}, {kdkClearanceAttested: true},
    {holdoutRead: true}, {scoringAuthorized: true}, {publicationAuthorized: true},
    {privateForecasts: [0.2,0.3,0.5]}, {a6Tables: 2}, {extra: false},
  ]) assert.equal(inspectRecordedM4OwnerStatus({...snapshot,...patch}), null);
  const missing = {...snapshot};
  delete missing.captures;
  assert.equal(inspectRecordedM4OwnerStatus(missing), null);
  for (const bad of [null,[],true,'snapshot']) assert.equal(inspectRecordedM4OwnerStatus(bad),null);
});

test('route authorizes owner before inspecting and has no privileged controls', () => {
  const route = readFileSync(new URL('../app/(console)/admin/prospective/page.tsx',import.meta.url),'utf8');
  assert.match(route,/import 'server-only'/);
  assert.match(route,/await requireOwner\(\);\s+const summary = inspectRecordedM4OwnerStatus/);
  assert.match(route,/dynamic = 'force-dynamic'/);
  for (const bad of ['use client','use server','<form','<button','fetch(', 'serverClient('])
    assert.ok(!route.includes(bad),bad);
});
