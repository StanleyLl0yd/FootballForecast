import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM3MissingCc0PublicTotals} from '../lib/m3-public-missing-seasons.mjs';

const original=JSON.parse(readFileSync(
  new URL('../../../docs/M3_TWO_MISSING_CC0_SEASONS_PUBLIC_TOTALS_EVIDENCE.json',
    import.meta.url),'utf8'));
const modify=change=>{const copy=structuredClone(original);change(copy);return copy;};
const invalid={state:'invalid',seasons:[],publicTotalsAgreementCount:0,
  privatelyCertifiedMatches:0,realTrainingAuthorized:false};

test('two public retrospective goal totals agree without fixture or licence certification',()=>{
  const result=inspectM3MissingCc0PublicTotals(original);
  assert.equal(result.state,'public_aggregate_concordance_unapproved');
  assert.deepEqual(result.seasons,[
    {season:'2021/22',finishedRows:240,publicGoals:639,revisionCaveat:false},
    {season:'2022/23',finishedRows:240,publicGoals:730,revisionCaveat:true}
  ]);
  assert.equal(result.publicTotalsAgreementCount,2);
  assert.equal(result.privatelyCertifiedMatches,0);
  assert.equal(result.realTrainingAuthorized,false);
  assert.doesNotMatch(JSON.stringify(result),/sourceMatchId|homeTeamId|providerId/i);
});

test('tampered rights, score totals, source digest or disguised training fail closed',()=>{
  const changes=[
    x=>{x.schemaVersion=2;},
    x=>{x.kind='M3_APPROVED_LABELS';},
    x=>{x.scope='PRIVATE_EXPORT';},
    x=>{x.sourceFootbolno.originalSourceSha256='a'.repeat(64);},
    x=>{x.sourceFootbolno.originalSourceBytes++;},
    x=>{x.sourceFootbolno.publisherDeclaredLicense='CC0';},
    x=>{x.sourceFootbolno.privateOpenFootRightsInferredFromFootbolno=true;},
    x=>{x.sourceFootbolno.originalOnFieldResultsCertified=true;},
    x=>{x.sourceFootbolno.historicalFirstPublicationAuthenticated=true;},
    x=>{x.seasons[0].season='2025/26';},
    x=>{x.seasons[0].footbolnoFinishedProviderRows=239;},
    x=>{x.seasons[0].footbolnoHomeGoals++;},
    x=>{x.seasons[1].rsssfOfficialFinalTableGoalsForSum=729;},
    x=>{x.seasons[1].knownAdministrativeResultRevision=false;},
    x=>{x.seasons[1].independentlyCertifiedPrivateMatches=239;},
    x=>{x.seasons[0].rawRows=[{id:'private'}];},
    x=>{x.seasons.reverse();},
    x=>{x.limits.modelTrainingAuthorized=true;},
    x=>{x.limits.heldout2025_26Read=true;},
    x=>{x.limits.totalGoalsEqualityProvesIndividualFixtures=true;},
    x=>{x.limits.noSupabaseDataAccess=false;},
    x=>{x.extra='unsafe';}
  ];
  for(const change of changes){
    assert.deepEqual(inspectM3MissingCc0PublicTotals(modify(change)),invalid);
  }
});

test('unknown containers are rejected, never coerced to approval',()=>{
  for(const d of [null,undefined,{},[],false,1,'test']){
    assert.deepEqual(inspectM3MissingCc0PublicTotals(d),invalid);
  }
});

test('owner-only route validates before showing public aggregate research',()=>{
  const route=readFileSync(new URL('../app/(console)/admin/research/page.tsx',
    import.meta.url),'utf8');
  const auth=route.indexOf('await requireOwner()');
  const inspect=route.indexOf('inspectM3MissingCc0PublicTotals(m3MissingCc0Evidence)');
  assert.ok(auth>=0&&inspect>auth);
  assert.match(route,/M3_TWO_MISSING_CC0_SEASONS_PUBLIC_TOTALS_EVIDENCE\.json/);
  assert.match(route,/отдельных матчей не проверено/);
  assert.doesNotMatch(route,/service_role|INSERT INTO|createClient\s*\(/);
});
