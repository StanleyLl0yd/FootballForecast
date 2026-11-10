import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM3SourceRights} from '../lib/m3-source-rights.mjs';

const original=JSON.parse(readFileSync(
  new URL('../../../docs/M3_A3_SOURCE_RIGHTS_READINESS_EVIDENCE.json',import.meta.url),
  'utf8'
));
const edit=mutation=>{
  const copy=structuredClone(original);
  mutation(copy);
  return copy;
};
const invalid={state:'invalid',seasons:[],rightsVerifiedSeasons:0,
  eligibleRowsAttested:0,realTrainingAuthorized:false};

test('seven seasons are honest rights-unverified, with no real approval',()=>{
  const result=inspectM3SourceRights(original);
  assert.equal(result.state,'recorded_unapproved');
  assert.deepEqual(result.seasons,['2018/19','2019/20','2020/21','2021/22',
    '2022/23','2023/24','2024/25']);
  assert.equal(result.rightsVerifiedSeasons,0);
  assert.equal(result.eligibleRowsAttested,0);
  assert.equal(result.realTrainingAuthorized,false);
  assert.doesNotMatch(JSON.stringify(result),/source_match_id|home_team_id|kickoff_at/i);
});

test('promoted claims, disguised heldout year and leaked raw rows fail closed',()=>{
  const mutations=[
    x=>{x.provider.actualRplHistoricalUpstreamLicenseAuthenticated=true;},
    x=>{x.provider.internalModelTrainingOnLawfullyObtainedDataPermitted=false;},
    x=>{x.provider.originalPerResponseSourceLicenseRetainedInPrivateArchive=true;},
    x=>{x.externalReferences[0].fullSevenSeasonCc0Coverage=true;},
    x=>{x.externalReferences[1].bulkMachineReuseApproved=true;},
    x=>{x.externalReferences[2].heavyAutomatedTrainingApproved=true;},
    x=>{x.externalReferences[2].originalQuoteCutoffVerified=true;},
    x=>{x.gates.realTrainingAuthorized=true;},
    x=>{x.gates.restrictedPrivateRowCorrelationAuthorized=true;},
    x=>{x.gates.sealed2025_26Read=true;},
    x=>{x.gates.fullSeasonPlayedGoalResultsVerified=true;},
    x=>{x.seasons[0].sourceRightsDecision='RIGHTS_APPROVED';},
    x=>{x.seasons[0].realPrivateEligibleRowsAttested=240;},
    x=>{x.seasons[0].privateProviderFinishedRows=239;},
    x=>{x.seasons[0].privateRows=[{id:'sensitive'}];},
    x=>{x.seasons[4].season='2025/26';},
    x=>{x.seasons[3].pinnedPublicCc0StructuralRows=240;},
    x=>{x.seasons.reverse();},
    x=>{x.externalReferences.reverse();},
    x=>{x.extra='unreviewed';},
    x=>{x.kind='M3_A3_TRAINING_AUTHORIZED';},
    x=>{x.scope='PRIVATE_ROW_CORRELATION';}
  ];
  for(const mutate of mutations){
    assert.deepEqual(inspectM3SourceRights(edit(mutate)),invalid);
  }
});

test('malformed containers and absent evidence are never accepted',()=>{
  for(const input of [null,undefined,[],{},'ok',123,structuredClone(original.seasons)]){
    assert.deepEqual(inspectM3SourceRights(input),invalid);
  }
});

test('owner research route checks source rights only after owner auth',()=>{
  const route=readFileSync(new URL('../app/(console)/admin/research/page.tsx',
    import.meta.url),'utf8');
  const auth=route.indexOf('await requireOwner()');
  const inspection=route.indexOf('inspectM3SourceRights(m3RightsEvidence)');
  assert.ok(auth>=0&&inspection>auth);
  assert.match(route,/M3_A3_SOURCE_RIGHTS_READINESS_EVIDENCE\.json/);
  assert.match(route,/RIGHTS_UNVERIFIED/);
  assert.doesNotMatch(route,/service_role|INSERT INTO|createClient\s*\(/);
});
