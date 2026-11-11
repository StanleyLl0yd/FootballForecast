import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {inspectM4SignedMetadata} from '../lib/m4-signed-metadata.mjs';

const NOW='2026-11-11T12:00:00Z';
const SHA=c=>c.repeat(64);
const issuer=()=>({
  source:{sourceId:'source-api',keyId:'source-v1',secret:Buffer.alloc(32,11)},
  kickoff:{sourceId:'official-fixtures',keyId:'official-v1',secret:Buffer.alloc(32,77)}
});
const fixture=()=>({
  competition:'RPL',season:'2026/27',fixtureKey:'rpl-synthetic-future',
  homeClubKey:'zenit',awayClubKey:'spartak',
  scheduledKickoffUtc:'2026-11-12T13:00:00Z',
  observedAtUtc:'2026-11-11T11:30:00Z',
  recordedAtUtc:'2026-11-11T11:30:01Z',
  sourceRevisionSha256:SHA('a'),kickoffEvidenceSha256:SHA('b'),
  teamMappingSha256:SHA('c'),status:'scheduled',revisionKind:'none'
});
const SOURCE=[
  'kind','keyId','sourceId','fixtureKey','season','homeClubKey','awayClubKey',
  'scheduledKickoffUtc','status','revisionKind','sourceRevisionSha256',
  'teamMappingSha256','observedAtUtc','recordedAtUtc'
];
const KICKOFF=[
  'kind','keyId','sourceId','fixtureKey','season','homeClubKey','awayClubKey',
  'scheduledKickoffUtc','kickoffEvidenceSha256','observedAtUtc','recordedAtUtc'
];
const signed=(row,fields,secret)=>{
  const payload=JSON.stringify([row.kind,...fields.slice(1).map(k=>row[k])]);
  return {...row,macSha256:createHmac('sha256',secret).update(payload).digest('hex')};
};
const make=(f=fixture(),keys=issuer())=>{
  const source=signed({
    kind:'m4-source-observation-v1',keyId:keys.source.keyId,sourceId:keys.source.sourceId,
    fixtureKey:f.fixtureKey,season:f.season,homeClubKey:f.homeClubKey,
    awayClubKey:f.awayClubKey,scheduledKickoffUtc:f.scheduledKickoffUtc,
    status:f.status,revisionKind:f.revisionKind,
    sourceRevisionSha256:f.sourceRevisionSha256,
    teamMappingSha256:f.teamMappingSha256,
    observedAtUtc:f.observedAtUtc,recordedAtUtc:f.recordedAtUtc
  },SOURCE,keys.source.secret);
  const kickoff=signed({
    kind:'m4-kickoff-corroboration-v1',keyId:keys.kickoff.keyId,
    sourceId:keys.kickoff.sourceId,fixtureKey:f.fixtureKey,season:f.season,
    homeClubKey:f.homeClubKey,awayClubKey:f.awayClubKey,
    scheduledKickoffUtc:f.scheduledKickoffUtc,
    kickoffEvidenceSha256:f.kickoffEvidenceSha256,
    observedAtUtc:'2026-11-11T11:35:00Z',
    recordedAtUtc:'2026-11-11T11:35:01Z'
  },KICKOFF,keys.kickoff.secret);
  return {source,kickoff};
};
const verify=(f=fixture(),receipts=make(f),keys=issuer(),now=NOW)=>
  inspectM4SignedMetadata(f,receipts,now,keys);
const check=mutate=>{
 const f=fixture(),k=issuer(),r=make(f,k);
 mutate(f,r,k);
 return verify(f,r,k);
};
test('two independently signed receipts are only a private structural candidate',()=>{
 const a=verify();
 assert.equal(a.state,'authenticated_candidate_only');
 assert.equal(a.signatureVerified,true);
 assert.equal(a.independentIssuersConfigured,true);
 assert.equal(a.genuineAsOfAttested,false);
 for(const key of ['modelApproved','writeAuthorized','publicationAuthorized'])
   assert.equal(a[key],false);
 assert.equal(a.privateShadowOnly,true);
 assert.equal(a.leadSeconds,90000);
 assert.equal(Object.isFrozen(a),true);
 for(const key of ['fixtureKey','sourceId','rawMatch','score','macSha256'])
   assert.equal(Object.hasOwn(a,key),false);
});
test('without independently configured trusted keys or receipts deny',()=>{
 for(const [r,k] of [[null,issuer()],[make(),null],[{},issuer()],
    [make(),{source:issuer().source}],[make(),{source:issuer().source,kickoff:{}}],
    [make(),{source:{...issuer().source,secret:'bad'},kickoff:issuer().kickoff}]])
  assert.equal(verify(fixture(),r,k).state,'blocked');
});
test('not independent if same source id, key id or signing secret',()=>{
 assert.equal(check((f,r,k)=>{k.kickoff.sourceId=k.source.sourceId;}).reason,
   'NOT_INDEPENDENT_ISSUERS');
 assert.equal(check((f,r,k)=>{k.kickoff.keyId=k.source.keyId;}).reason,
   'NOT_INDEPENDENT_ISSUERS');
 assert.equal(check((f,r,k)=>{k.kickoff.secret=Buffer.from(k.source.secret);}).reason,
   'NOT_INDEPENDENT_ISSUERS');
});
test('tampered claims, issuer identities and signatures fail closed',()=>{
 for(const mutate of [
  (f,r)=>{r.source.status='finished';},
  (f,r)=>{r.kickoff.scheduledKickoffUtc='2026-11-12T14:00:00Z';},
  (f,r)=>{r.source.macSha256='0'.repeat(64);},
  (f,r)=>{r.source.keyId='evil';},
  (f,r)=>{r.kickoff.sourceId='source-api';},
  (f,r)=>{r.kickoff.macSha256='F'.repeat(64);},
  (f,r)=>{r.kickoff.rawBody={secret:true};},
  (f,r)=>{delete r.source.sourceRevisionSha256;},
 ])assert.equal(check(mutate).state,'blocked');
});
test('signed source must agree with independent candidate fields',()=>{
 for(const field of ['sourceRevisionSha256','teamMappingSha256',
   'scheduledKickoffUtc','fixtureKey','homeClubKey','awayClubKey',
   'recordedAtUtc','observedAtUtc']){
  const result=check((f,r,k)=>{
    const before={...r.source};
    r.source=signed({...before,[field]:field.includes('Sha256')?SHA('f'):
      field.includes('Utc')?'2026-11-13T13:00:00Z':'other'},
      SOURCE,k.source.secret);
  });
  assert.equal(result.state,'blocked',field);
 }
});
test('signed kickoff must independently agree with fixture and evidence hash',()=>{
 for(const field of ['fixtureKey','homeClubKey','awayClubKey',
   'scheduledKickoffUtc','kickoffEvidenceSha256']){
  const result=check((f,r,k)=>{
    r.kickoff=signed({...r.kickoff,[field]:field.includes('Sha256')?SHA('e'):
      field.includes('Utc')?'2026-11-13T13:00:00Z':'different'},KICKOFF,k.kickoff.secret);
  });
  assert.equal(result.reason,'KICKOFF_RECEIPT_MISMATCH',field);
 }
});
test('correctly signed backdating and time inversion still rejected',()=>{
 const timeCases=[
  ['observedAtUtc','2026-11-11T11:04:56Z'],
  ['observedAtUtc','2026-11-10T11:30:00Z'],
  ['recordedAtUtc','2026-11-11T12:00:01Z'],
 ];
 for(const [field,when] of timeCases) {
   const f=fixture(),keys=issuer();
   f[field]=when;
   assert.equal(verify(f,make(f,keys),keys).state,'blocked',field);
 }
 for(const [field,when] of [
  ['observedAtUtc','2026-11-11T11:04:56Z'],
  ['observedAtUtc','2026-11-11T11:59:59Z'],
  ['recordedAtUtc','2026-11-11T11:34:59Z'],
  ['recordedAtUtc','2026-11-12T14:00:00Z'],
 ]) {
  const result=check((f,r,k)=>{
   r.kickoff=signed({...r.kickoff,[field]:when},KICKOFF,k.kickoff.secret);
  });
  assert.equal(result.state,'blocked',field);
 }
});
test('cannot reframe consumed 2025/26 or finished / revised events',()=>{
 for(const [field,value] of [['season','2025/26'],['status','finished'],
   ['revisionKind','changed_kickoff'],['season','2018/19']]){
  assert.equal(check(f=>{f[field]=value;}).state,'blocked');
 }
});
test('invalid key types and crafted objects do not throw or leak',()=>{
 const bad=[
  {source:{...issuer().source,secret:Buffer.alloc(31)},kickoff:issuer().kickoff},
  {source:{...issuer().source,secret:Buffer.alloc(200)},kickoff:issuer().kickoff},
  Object.assign(Object.create(null),issuer()),
  {source:{...issuer().source,sourceId:'other space'},kickoff:issuer().kickoff}
 ];
 for(const key of bad)assert.equal(verify(fixture(),make(),key).state,'blocked');
});
test('no I/O, source download, model fit or automatic privileged work in verifier',()=>{
 const text=readFileSync(new URL('../lib/m4-signed-metadata.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/\bfetch\s*\(|\bwriteFile\s*\(|\bsupabase\b|INSERT INTO|process\.env|service_role/i);
 assert.match(text,/writeAuthorized:false/);
 assert.match(text,/genuineAsOfAttested:false/);
});
