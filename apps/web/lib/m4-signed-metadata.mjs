/**
 * M4-A2 pure, fail-closed authenticated METADATA preflight. No I/O or writes.
 *
 * Signatures authenticate separately configured capture and kickoff-review
 * issuers. They do not independently prove a real capture, correct source data,
 * server clock accuracy or immutable storage. A5 must establish those facts.
 * No caller may treat a verified receipt as model/write/publication approval.
 */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {inspectM4ProspectiveCandidate,M4_START_UTC}
  from './m4-prospective-preflight.mjs';

const SHA=/^[a-f0-9]{64}$/;
const IDENT=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const PRIMARY=Object.freeze([
  'kind','keyId','sourceId','fixtureKey','season','homeClubKey',
  'awayClubKey','scheduledKickoffUtc','status','revisionKind',
  'sourceRevisionSha256','teamMappingSha256','observedAtUtc',
  'recordedAtUtc'
]);
const INDEPENDENT=Object.freeze([
  'kind','keyId','sourceId','fixtureKey','season','homeClubKey',
  'awayClubKey','scheduledKickoffUtc','kickoffEvidenceSha256',
  'observedAtUtc','recordedAtUtc'
]);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const validKeys=(x,fields)=>isObject(x)&&Object.keys(x).length===fields.length+1&&
  fields.every(k=>Object.hasOwn(x,k))&&Object.hasOwn(x,'macSha256');
const iso=x=>{
  if(typeof x!=='string'||!UTC.test(x))return null;
  const t=Date.parse(x);
  return Number.isFinite(t)&&new Date(t).toISOString()===x.replace('Z','.000Z')?t:null;
};
const reject=reason=>Object.freeze({
  state:'blocked',reason,signatureVerified:false,privateShadowOnly:true,
  genuineAsOfAttested:false,modelApproved:false,writeAuthorized:false,
  publicationAuthorized:false
});
const config=x=>isObject(x)&&Object.keys(x).length===3&&
  IDENT.test(x.keyId)&&IDENT.test(x.sourceId)&&
  Buffer.isBuffer(x.secret)&&x.secret.length>=32&&x.secret.length<=128;
const validSigned=(r,fields,kind,issuer)=>{
  if(!validKeys(r,fields)||r.kind!==kind||
     r.keyId!==issuer.keyId||r.sourceId!==issuer.sourceId||
     typeof r.macSha256!=='string'||!SHA.test(r.macSha256)||
     !fields.every(k=>typeof r[k]==='string'))return false;
  const canonical=JSON.stringify([kind,...fields.slice(1).map(k=>r[k])]);
  const expected=createHmac('sha256',issuer.secret).update(canonical,'utf8').digest();
  const actual=Buffer.from(r.macSha256,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
};
/**
 * @param {unknown} fixture - Untrusted candidate metadata, no model or scores.
 * @param {unknown} receipts - {source,kickoff}, independently signed.
 * @param {unknown} assessedAtUtc - Caller clock; NOT proof of a server clock.
 * @param {unknown} trustedIssuers - Server-provided {source,kickoff} key config.
 */
export function inspectM4SignedMetadata(fixture,receipts,assessedAtUtc,trustedIssuers){
  const candidate=inspectM4ProspectiveCandidate(fixture,assessedAtUtc);
  if(candidate.state!=='candidate_only')return reject(candidate.reason);
  if(!isObject(receipts)||Object.keys(receipts).length!==2||
     !Object.hasOwn(receipts,'source')||!Object.hasOwn(receipts,'kickoff')||
     !isObject(trustedIssuers)||Object.keys(trustedIssuers).length!==2||
     !config(trustedIssuers.source)||!config(trustedIssuers.kickoff))
    return reject('MISSING_TRUSTED_RECEIPTS');
  const a=trustedIssuers.source,b=trustedIssuers.kickoff;
  if(a.sourceId===b.sourceId||a.keyId===b.keyId||
     a.secret.length===b.secret.length&&timingSafeEqual(a.secret,b.secret))
    return reject('NOT_INDEPENDENT_ISSUERS');
  const source=receipts.source,kickoff=receipts.kickoff;
  if(!validSigned(source,PRIMARY,'m4-source-observation-v1',a)||
     !validSigned(kickoff,INDEPENDENT,'m4-kickoff-corroboration-v1',b))
    return reject('INVALID_RECEIPT_SIGNATURE_OR_SCHEMA');
  for(const k of ['fixtureKey','season','homeClubKey','awayClubKey',
      'scheduledKickoffUtc','status','revisionKind','sourceRevisionSha256',
      'teamMappingSha256','observedAtUtc','recordedAtUtc']){
    if(source[k]!==fixture[k])return reject('SOURCE_RECEIPT_MISMATCH');
  }
  for(const k of ['fixtureKey','season','homeClubKey','awayClubKey',
      'scheduledKickoffUtc','kickoffEvidenceSha256']){
    if(kickoff[k]!==fixture[k])return reject('KICKOFF_RECEIPT_MISMATCH');
  }
  const assessed=iso(assessedAtUtc);
  const first=iso(source.observedAtUtc),captured=iso(source.recordedAtUtc);
  const reviewed=iso(kickoff.observedAtUtc),reviewStored=iso(kickoff.recordedAtUtc);
  const kick=iso(fixture.scheduledKickoffUtc),origin=iso(M4_START_UTC);
  if([assessed,first,captured,reviewed,reviewStored,kick,origin]
    .some(x=>x===null)||first<=origin||reviewed<=origin||
     first>captured||captured>assessed||reviewed>reviewStored||
     reviewStored>assessed||reviewStored>=kick||captured>=kick)
    return reject('NON_PROSPECTIVE_RECEIPT_TIME');
  // Cryptography authenticates the claimed metadata to TWO configured issuers,
  // but only A5's external trusted capture and immutable ledger can prove as-of.
  return Object.freeze({
    state:'authenticated_candidate_only',reason:'A5_TRUSTED_CLOCK_AND_LEDGER_NOT_YET_PROVEN',
    signatureVerified:true,independentIssuersConfigured:true,
    leadSeconds:candidate.leadSeconds,privateShadowOnly:true,
    genuineAsOfAttested:false,modelApproved:false,writeAuthorized:false,
    publicationAuthorized:false
  });
}
