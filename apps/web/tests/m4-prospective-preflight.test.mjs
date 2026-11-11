import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {inspectM4ProspectiveCandidate,M4_START_UTC,M4_MIN_LEAD_SECONDS}
  from '../lib/m4-prospective-preflight.mjs';

const NOW='2026-11-11T12:00:00Z';
const base=()=>({
 competition:'RPL',season:'2026/27',fixtureKey:'rpl-future-001',
 homeClubKey:'zenit',awayClubKey:'spartak',
 scheduledKickoffUtc:'2026-11-12T13:00:00Z',
 observedAtUtc:'2026-11-11T11:30:00Z',
 recordedAtUtc:'2026-11-11T11:30:01Z',
 sourceRevisionSha256:'a'.repeat(64),kickoffEvidenceSha256:'b'.repeat(64),
 teamMappingSha256:'c'.repeat(64),status:'scheduled',revisionKind:'none'
});
const changed=(mutate,clock=NOW)=>{
 const p=base();mutate(p);return inspectM4ProspectiveCandidate(p,clock);
};
test('M4 start is anchored to issue creation; future candidate is NOT approval',()=>{
 assert.equal(M4_START_UTC,'2026-11-11T11:04:56Z');
 assert.equal(M4_MIN_LEAD_SECONDS,900);
 const result=inspectM4ProspectiveCandidate(base(),NOW);
 assert.equal(result.state,'candidate_only');
 assert.equal(result.leadSeconds,90000);
 for(const k of ['publicationAuthorized','genuineAsOfAttested','modelApproved','writeAuthorized'])
  assert.equal(result[k],false);
 assert.equal(result.privateShadowOnly,true);
 assert.ok(Object.isFrozen(result));
 for(const key of ['fixtureKey','homeClubKey','awayClubKey','rawMatch','sourceRevisionSha256'])
  assert.equal(Object.hasOwn(result,key),false);
});
test('consumed 2025/26, older and unsupported seasons/competitions reject',()=>{
 for(const [k,v] of [['season','2025/26'],['season','2024/25'],
   ['season','2027/28'],['competition','EPL']])
  assert.equal(changed(p=>{p[k]=v;}).state,'blocked');
});
test('missing, extra, result and publication fields reject',()=>{
 assert.equal(inspectM4ProspectiveCandidate(null,NOW).state,'blocked');
 assert.equal(inspectM4ProspectiveCandidate([],NOW).state,'blocked');
 assert.equal(changed(p=>{delete p.fixtureKey;}).reason,'MALFORMED_OR_UNEXPECTED_FIELDS');
 for(const k of ['forecast','score','outcome','publish','holdout2025_26Read'])
  assert.equal(changed(p=>{p[k]=true;}).reason,'MALFORMED_OR_UNEXPECTED_FIELDS');
});
test('fixture identity, status and revision ambiguity reject',()=>{
 for(const [k,v] of [
  ['fixtureKey','../2025-26'],['fixtureKey','rpl-!'],['homeClubKey',''],
  ['awayClubKey','zenit'],['homeClubKey','SECRET Name'],
  ['status','finished'],['status','postponed'],['status','awarded'],
  ['revisionKind','changed_kickoff'],['revisionKind','unknown']
 ])assert.equal(changed(p=>{p[k]=v;}).state,'blocked');
});
test('source, kickoff and mapping hashes require distinct lower-case SHA-256',()=>{
 for(const [k,v] of [
  ['sourceRevisionSha256','a'.repeat(63)],
  ['sourceRevisionSha256','A'.repeat(64)],
  ['teamMappingSha256','a'.repeat(64)],
  ['kickoffEvidenceSha256','c'.repeat(64)],
  ['teamMappingSha256','not verified']
 ])assert.equal(changed(p=>{p[k]=v;}).reason,'UNVERIFIED_EVIDENCE_DIGESTS');
});
test('timestamp inputs require actual canonical UTC seconds precision',()=>{
 for(const [k,v] of [
  ['observedAtUtc','2026-11-11T14:30:00+03:00'],
  ['recordedAtUtc','2026-11-11T11:30Z'],
  ['scheduledKickoffUtc','2026-02-30T12:00:00Z'],
  ['scheduledKickoffUtc','2026-11-12T13:00:00.000Z'],
  ['observedAtUtc','2026-13-11T11:30:00Z']
 ])assert.equal(changed(p=>{p[k]=v;}).reason,'INVALID_UTC_TIMESTAMP');
 for(const v of ['2026-11-11T15:00:00+03:00','2026-11-11','bad'])
  assert.equal(inspectM4ProspectiveCandidate(base(),v).reason,'INVALID_UTC_TIMESTAMP');
});
test('no pre-M4 capture, time-order inversion or future recorded claim',()=>{
 for(const [k,v] of [
  ['observedAtUtc','2026-11-11T11:04:56Z'],
  ['observedAtUtc','2026-11-10T11:30:00Z'],
  ['recordedAtUtc','2026-11-11T11:29:59Z'],
  ['recordedAtUtc','2026-11-11T12:00:01Z']
 ])assert.equal(changed(p=>{p[k]=v;}).reason,'NOT_GENUINELY_FORWARD_OBSERVED');
});
test('at least 15 minutes lead is required at structural evaluation time',()=>{
 for(const kickoff of ['2026-11-11T12:14:59Z','2026-11-11T11:59:59Z'])
  assert.equal(changed(p=>{p.scheduledKickoffUtc=kickoff;})
    .reason,'INSUFFICIENT_PREMATCH_LEAD');
 assert.equal(changed(p=>{p.scheduledKickoffUtc='2026-11-11T12:15:00Z';})
  .state,'candidate_only');
});
test('preflight is pure; it cannot publish or open any database',()=>{
 const src=readFileSync(new URL('../lib/m4-prospective-preflight.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|\bwriteFile\s*\(|\bsupabase\b|INSERT INTO|process\.env|service_role/i);
 assert.match(src,/candidate_only/);
 assert.match(src,/writeAuthorized:false/);
});
