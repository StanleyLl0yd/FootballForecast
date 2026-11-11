/**
 * M4-A2: Pure, insufficient-by-design preflight for future RPL fixture candidates.
 * A caller's time or digest is not trusted first-observation evidence.
 * Success returns candidate_only, NEVER forecast/write/publication authorization.
 */
export const M4_START_UTC='2026-11-11T11:04:56Z'; // GitHub #304 created_at
export const M4_MIN_LEAD_SECONDS=900;
const SHA=/^[0-9a-f]{64}$/;
const CLUB=/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const FIXTURE=/^rpl-[a-z0-9](?:[a-z0-9-]{0,93}[a-z0-9])?$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const REQUIRED=Object.freeze([
 'competition','season','fixtureKey','homeClubKey','awayClubKey',
 'scheduledKickoffUtc','observedAtUtc','recordedAtUtc',
 'sourceRevisionSha256','kickoffEvidenceSha256','teamMappingSha256',
 'status','revisionKind'
]);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
const utc=x=>{
 if(typeof x!=='string'||!UTC.test(x))return null;
 const m=Date.parse(x);
 if(!Number.isFinite(m)||new Date(m).toISOString()!==x.replace('Z','.000Z'))
  return null;
 return m/1000;
};
const refuse=reason=>Object.freeze({
 state:'blocked',reason,privateShadowOnly:true,publicationAuthorized:false,
 genuineAsOfAttested:false,modelApproved:false,writeAuthorized:false
});
/**
 * @param {unknown} input - Untrusted source-metadata envelope; not a receipt.
 * @param {unknown} assessedAtUtc - Caller clock (only structurally checked).
 * A separate trusted server observation + append-only ledger is mandatory.
 */
export function inspectM4ProspectiveCandidate(input,assessedAtUtc){
 if(!obj(input)||Object.keys(input).length!==REQUIRED.length||
    !REQUIRED.every(k=>Object.hasOwn(input,k)))
  return refuse('MALFORMED_OR_UNEXPECTED_FIELDS');
 const now=utc(assessedAtUtc),observed=utc(input.observedAtUtc);
 const recorded=utc(input.recordedAtUtc),kickoff=utc(input.scheduledKickoffUtc);
 if([now,observed,recorded,kickoff].some(x=>x===null))
  return refuse('INVALID_UTC_TIMESTAMP');
 if(input.competition!=='RPL'||input.season!=='2026/27')
  return refuse('OUT_OF_SCOPE_SEASON');
 if(!FIXTURE.test(input.fixtureKey)||!CLUB.test(input.homeClubKey)||
    !CLUB.test(input.awayClubKey)||input.homeClubKey===input.awayClubKey)
  return refuse('AMBIGUOUS_FIXTURE_IDENTITY');
 if(input.status!=='scheduled'||input.revisionKind!=='none')
  return refuse('NOT_UNREVISED_SCHEDULED');
 const digests=[input.sourceRevisionSha256,input.kickoffEvidenceSha256,
  input.teamMappingSha256];
 if(!digests.every(x=>typeof x==='string'&&SHA.test(x))||
    new Set(digests).size!==3)
  return refuse('UNVERIFIED_EVIDENCE_DIGESTS');
 if(observed<=Date.parse(M4_START_UTC)/1000||
    recorded<observed||now<recorded)
  return refuse('NOT_GENUINELY_FORWARD_OBSERVED');
 const leadSeconds=kickoff-now;
 if(leadSeconds<M4_MIN_LEAD_SECONDS)
  return refuse('INSUFFICIENT_PREMATCH_LEAD');
 return Object.freeze({
  state:'candidate_only',
  reason:'TRUSTED_CAPTURE_MODEL_LOCK_AND_PRIVATE_LEDGER_REQUIRED',
  leadSeconds,privateShadowOnly:true,publicationAuthorized:false,
  genuineAsOfAttested:false,modelApproved:false,writeAuthorized:false
 });
}
