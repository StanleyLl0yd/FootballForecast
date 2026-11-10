/** M3-A3 public metadata triage. No I/O, no authorization for private rows or model fitting. */
import {createHash} from 'node:crypto';

const years=['2018/19','2019/20','2020/21','2021/22',
  '2022/23','2023/24','2024/25'];
const expectedCc0=[240,240,240,null,null,240,240];
const rootKeys=['schemaVersion','kind','observedOn','scope','provider',
  'externalReferences','seasons','gates'];
const providerKeys=['name','termsUrl','termsEffective',
  'internalModelTrainingOnLawfullyObtainedDataPermitted',
  'actualRplHistoricalUpstreamLicenseAuthenticated',
  'originalPerResponseSourceLicenseRetainedInPrivateArchive'];
const refKeys=[
  ['key','url','copyrightClass','fullSevenSeasonCc0Coverage',
    'authoritativePlayedResultsCertified'],
  ['key','url','copyrightClass','bulkMachineReuseApproved',
    'originalFirstServingUtcVerified'],
  ['key','url','copyrightClass','heavyAutomatedTrainingApproved',
    'originalQuoteCutoffVerified']
];
const seasonKeys=['season','privateProviderFinishedRows',
  'pinnedPublicCc0StructuralRows','alternativeReference',
  'realPrivateEligibleRowsAttested','sourceRightsDecision'];
const gateKeys=['actualPrivateFeedUpstreamLicenseAuthenticated',
  'fullSeasonIndependentNamedIdentityVerified',
  'fullSeasonPlayedGoalResultsVerified',
  'originalHistoricalFirstServingUtcVerified',
  'restrictedPrivateRowCorrelationAuthorized',
  'realTrainingAuthorized','sealed2025_26Read'];
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(item,fields)=>isRecord(item)&&Object.keys(item).length===fields.length&&
  fields.every(key=>Object.hasOwn(item,key));
const invalid=()=>({state:'invalid',seasons:[],rightsVerifiedSeasons:0,
  eligibleRowsAttested:0,realTrainingAuthorized:false});

/**
 * @param {unknown} payload Public-only committed metadata, not a provider response.
 * @returns {{state:string,seasons:string[],rightsVerifiedSeasons:number,
 * eligibleRowsAttested:number,realTrainingAuthorized:boolean}}
 */
export function inspectM3SourceRights(payload){
  try{
    if(!exact(payload,rootKeys))return invalid();
    const d=payload;
    if(d.schemaVersion!==1||d.kind!=='M3_A3_PUBLIC_SOURCE_RIGHTS_READINESS'||
       d.observedOn!=='2026-11-10'||
       d.scope!=='PUBLIC_REFERENCE_METADATA_ONLY_NO_PRIVATE_READ')return invalid();
    const p=d.provider;
    if(!exact(p,providerKeys)||p.name!=='OpenFoot Starter'||
       p.termsUrl!=='https://openfootapi.com/terms'||
       p.termsEffective!=='2026-09-07'||
       p.internalModelTrainingOnLawfullyObtainedDataPermitted!==true||
       p.actualRplHistoricalUpstreamLicenseAuthenticated!==false||
       p.originalPerResponseSourceLicenseRetainedInPrivateArchive!==false)
      return invalid();
    if(!Array.isArray(d.externalReferences)||d.externalReferences.length!==3)
      return invalid();
    const [openfootball,rsssf,footballData]=d.externalReferences;
    if(!exact(openfootball,refKeys[0])||
       openfootball.key!=='openfootball'||
       openfootball.url!=='https://github.com/openfootball/europe'||
       openfootball.copyrightClass!=='REPO_DECLARED_CC0'||
       openfootball.fullSevenSeasonCc0Coverage!==false||
       openfootball.authoritativePlayedResultsCertified!==false||
       !exact(rsssf,refKeys[1])||rsssf.key!=='rsssf'||
       rsssf.url!=='https://www.rsssf.org/charter.html'||
       rsssf.copyrightClass!=='COPYRIGHTED_RETROSPECTIVE_REFERENCE'||
       rsssf.bulkMachineReuseApproved!==false||
       rsssf.originalFirstServingUtcVerified!==false||
       !exact(footballData,refKeys[2])||footballData.key!=='football-data'||
       footballData.url!=='https://football-data.co.uk/contact.php'||
       footballData.copyrightClass!=='PERSONAL_ACADEMIC_LIMITED'||
       footballData.heavyAutomatedTrainingApproved!==false||
       footballData.originalQuoteCutoffVerified!==false)return invalid();

    if(!Array.isArray(d.seasons)||d.seasons.length!==7||
       !d.seasons.every((s,i)=>exact(s,seasonKeys)&&s.season===years[i]&&
         s.privateProviderFinishedRows===240&&
         s.pinnedPublicCc0StructuralRows===expectedCc0[i]&&
         s.alternativeReference===(expectedCc0[i]===null?
           'RFS_RSSSF_SPOT_REFERENCE_ONLY':'NOT_REQUIRED_FOR_CC0_STRUCTURE')&&
         s.realPrivateEligibleRowsAttested===0&&
         s.sourceRightsDecision==='RIGHTS_UNVERIFIED'))return invalid();
    if(!exact(d.gates,gateKeys)||gateKeys.some(key=>d.gates[key]!==false))
      return invalid();
    return {
      state:'recorded_unapproved',
      seasons:[...years],rightsVerifiedSeasons:0,
      eligibleRowsAttested:0,realTrainingAuthorized:false
    };
  }catch{
    return invalid();
  }
}
