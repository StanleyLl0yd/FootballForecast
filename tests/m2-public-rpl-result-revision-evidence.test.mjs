import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const evidence = JSON.parse(readFileSync(
  new URL('../docs/M2_PUBLIC_RPL_RESULT_REVISION_EVIDENCE.json', import.meta.url),
  'utf8',
));

test('public revision evidence remains reference-only with research gates shut', () => {
  assert.equal(evidence.kind, 'M2_PUBLIC_RPL_RESULT_REVISION_CROSSCHECK');
  assert.equal(evidence.sample.season, '2022/23');
  assert.equal(evidence.sample.fieldMatchPlayed, true);
  assert.equal(evidence.sample.originalFieldResultLaterAnnulled, true);
  assert.equal(evidence.sample.technicalResultDifferent, true);
  assert.equal(evidence.sample.historicalOriginalFirstServingUtc, null);
  assert.equal(evidence.sample.matchSpecificCrossSourceIdentityReviewed, false);
  assert.deepEqual(evidence.sources.map((s) => new URL(s.url).hostname),
    ['www.rfs.ru', 'www.rfs.ru', 'www.rsssf.org']);
  for (const value of Object.values(evidence.gates)) assert.equal(value, false);
  assert.equal(evidence.m2AcceptedCriteria, 4);
});
