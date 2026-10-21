import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=name=>JSON.parse(readFileSync(new URL('../docs/'+name,import.meta.url),'utf8'));
const evidence=read('M0_CURRENT_RPL_TERMS_REVIEW.json');
const registry=read('M0_FREE_SOURCE_REGISTRY.json');
const minimum=read('M0_MINIMUM_RPL_SCOPE.json');
const byId=Object.fromEntries(registry.sources.map(s=>[s.id,s]));

test('strictly free SportScore API attribution claims cannot bypass general terms ambiguity',()=>{
  assert.equal(evidence.schemaVersion,1);
  assert.equal(evidence.kind,'M0_CURRENT_RPL_SOURCE_TERMS_RECONCILIATION_NOT_APPROVAL');
  assert.equal(evidence.sportscore.registryId,'sportscore');
  assert.match(evidence.sportscore.apiSpecificTerms,/sportscore\.com\/developers\/terms\//);
  assert.match(evidence.sportscore.generalSiteTerms,/sportscore\.com\/terms\//);
  assert.equal(evidence.sportscore.apiTermsLastUpdated,'2026-04-23');
  assert.equal(evidence.sportscore.generalSiteTermsLastUpdated,'2026-04-12');
  const t=evidence.sportscore.contradiction;
  assert.equal(t.apiSpecificPermitsAttributedCommercialApps,true);
  assert.equal(t.siteGeneralSaysNonCommercialSiteUseOnly,true);
  assert.equal(t.siteGeneralProhibitsSubstantialDatabaseExtraction,true);
  assert.equal(t.siteGeneralRestrictsAutomatedRequests,true);
  assert.equal(t.explicitApiOverridesGeneralSiteTermsConfirmed,false);
  assert.equal(t.needWrittenPriorityClarification,true);
  assert.match(t.preciseConflict,/scope and priority/i);
  assert.equal(evidence.sportscore.freeTier.knownPaymentRequired,false);
  assert.equal(evidence.sportscore.freeTier.keyRequired,false);
  assert.equal(evidence.sportscore.freeTier.approximateRequestsPer24HoursPerIP,10000);
  assert.equal(evidence.sportscore.freeTier.visibleLinkText,'Powered by SportScore');
  assert.equal(evidence.sportscore.freeTier.dofollowLinkRequired,true);
  assert.equal(evidence.sportscore.freeTier.prohibitsBulkDatasetRepublication,true);
  assert.equal(evidence.sportscore.freeTier.apiSpecificAllowsDerivedDashboardsAlertsAnalytics,true);
  assert.equal(evidence.sportscore.freeTier.apiSpecificAllowsCaching,true);
  for(const [key,value]of Object.entries(evidence.sportscore.unresolved))
    assert.equal(value,false,key);
  assert.match(byId.sportscore.rights,/conflict/);
  assert.match(byId.sportscore.limitations,/written clarification/);
  assert.equal(byId.sportscore.active,false);
  assert.equal(byId.sportscore.authorizedAutomatedTraining,false);
});

test('UEFA domestic calendar is manual third-party source, never an automatically ingestible original protocol',()=>{
  const s=byId['uefa-rpl-domestic'];
  assert.ok(s,'20th source must be retained');
  assert.equal(s.priority,3);
  assert.equal(s.zeroCost,'public-reference');
  assert.equal(s.access,'manual-reference');
  assert.equal(s.active,false);
  assert.equal(s.authorizedRawRepublication,false);
  assert.equal(s.authorizedAutomatedTraining,false);
  assert.equal(s.automatedExtraction,'prohibited-for-database-compilation-by-site-terms');
  assert.equal(s.verifiedCurrentRPLCoverage,false);
  assert.match(s.url,/uefa\.com\/nationalassociations\/rus\/domestic\/league\/1050\/matches/);
  assert.match(evidence.uefa.generalTerms,/uefa\.com\/termsconditions/);
  assert.equal(evidence.uefa.manualCitationOnly,true);
  for(const key of ['ingestionAllowed','redistributionAllowed','modelTrainingAllowed',
    'automatedExtractionAllowed','independentOfRplOriginalSourceVerified',
    'currentDataCompletenessVerified','originalDatabaseRightsVerified',
    'sourceFixturesDownloadedOrCopied'])assert.equal(evidence.uefa[key],false,key);
  assert.ok(minimum.minimumScope.some(x=>x.season==='2026/2027'&&x.role==='current_live'));
});

test('no false licensing approval, match rows, data calls or monetization entitlement',()=>{
  assert.equal(registry.sources.length,20);
  assert.equal(registry.policy.activeProviderIntegrations,0);
  for(const [key,value]of Object.entries(evidence.policy)){
    if(key==='maxMonthlySpendUSD')assert.equal(value,0);
    else assert.equal(value,false,key);
  }
  for(const key of ['matches','rawRows','fixtures','providerData','credentials'])
    assert.equal(Object.hasOwn(evidence,key),false);
  const letter=readFileSync(new URL('../docs/M0_SPORTSCORE_RIGHTS_INQUIRY.md',import.meta.url),'utf8');
  assert.match(letter,/НЕ ОТПРАВЛЕН/);
  assert.match(letter,/api@sportscore\.com/);
  assert.match(letter,/2024\/25/);
  assert.match(letter,/2025\/26/);
  assert.match(letter,/2026\/27/);
  assert.match(letter,/upstream|исходные/);
  assert.match(letter,/проблем|conditions|Terms/);
  const docs=readFileSync(new URL('../docs/DATA_SOURCES.md',import.meta.url),'utf8');
  assert.match(docs,/M0_CURRENT_RPL_TERMS_REVIEW\.json/);
  assert.match(docs,/20-source ranking registry/);
});

