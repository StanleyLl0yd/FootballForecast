import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const evidence = JSON.parse(readFileSync(
  new URL('../docs/M2_HISTORICAL_SOURCE_RIGHTS_GATE_EVIDENCE.json', import.meta.url),
  'utf8',
));

test('archive licences are not mistaken for a verified seven-season training grant', () => {
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.kind, 'M2_PUBLIC_HISTORICAL_SOURCE_RIGHTS_REVIEW');
  assert.equal(evidence.scope, 'BOUNDED_MANUAL_PUBLIC_REFERENCE_ONLY');
  assert.equal(evidence.observations.length, 3);
  assert.deepEqual(evidence.observations.map(x => new URL(x.url).hostname),
    ['github.com', 'www.rfs.ru', 'www.rsssf.org']);
  const [cc0, federation, archive] = evidence.observations;
  assert.equal(cc0.repoDeclaredCc0, true);
  assert.equal(cc0.originalMatchRecordAuthorityIndependentlyVerified, false);
  assert.equal(federation.sourceContentMassReuseApproved, false);
  assert.equal(federation.individualPublicFactsCategoricallyProhibited, false);
  assert.equal(archive.allArchiveTablesMachineUseRightsVerified, false);
  assert.equal(archive.originalHistoricalPublicationTimelineVerified, false);
  for (const value of Object.values(evidence.gates)) assert.equal(value, false);
  assert.equal(evidence.m2AcceptedCriteria, 4);
  assert.doesNotMatch(JSON.stringify(evidence), /"matchId"|"clubId"|"homeGoals"|"awayGoals"|"privateSourceId"/);
});
