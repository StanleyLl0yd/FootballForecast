/** Strict shape validation for the dated aggregate snapshot, not live status.
 * All displayed links are fixed by reviewed source code. No I/O or auth bypass.
 */
const sha = /^[0-9a-f]{64}$/;
const expected = Object.freeze({
  schemaVersion: 1, kind: 'M4_OWNER_RECORDED_AGGREGATE_ONLY',
  observedDateUtc: '2026-11-24',
  codeSha: '6713edaaa122d7bf3bcfa42ac39b1b6e0d9c67e6',
  captureRunId: '43866049302', clubRunId: '45341933790',
  clubBatchSha256: 'ca64b964c6471d61fdc63836aea5cf15a6b1a1e4aed2565465fd0bc94329b273',
  gatesAccepted: 5, gatesTotal: 8, captures: 8, timeProofs: 8,
  shadowEntries: 8, forecast: 6, abstain: 2, clubBodies: 8,
  publicForecasts: 0, publicOutcomes: 0, forceRlsM4Tables: 4, a6Tables: 0,
  modelApproved: false, holdoutRead: false, playedFinalAttested: false,
  kdkClearanceAttested: false, settlementAuthorized: false,
  scoringAuthorized: false, publicationAuthorized: false,
});

/** @param {unknown} value */
export function inspectRecordedM4OwnerStatus(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(expected);
  if (Object.keys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(value, key) || value[key] !== expected[key]) ||
      !sha.test(value.clubBatchSha256)) return null;
  // Return only the reviewed aggregate projection; do not forward input fields.
  return Object.freeze({
    recordedDate: expected.observedDateUtc,
    codeSha: expected.codeSha,
    captureRun: 'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/43866049302',
    clubRun: 'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/45341933790',
    blocker: 'https://github.com/StanleyLl0yd/FootballForecast/issues/333',
    milestone: 'https://github.com/StanleyLl0yd/FootballForecast/issues/304',
    gatesAccepted: expected.gatesAccepted, gatesTotal: expected.gatesTotal,
    captures: expected.captures, timeProofs: expected.timeProofs,
    shadowEntries: expected.shadowEntries, forecast: expected.forecast,
    abstain: expected.abstain, clubBodies: expected.clubBodies,
    publicForecasts: expected.publicForecasts, publicOutcomes: expected.publicOutcomes,
    forceRlsM4Tables: expected.forceRlsM4Tables, a6Tables: expected.a6Tables,
    liveVerified: false, playedFinalAttested: false,
    scoringAuthorized: false, publicationAuthorized: false,
  });
}
