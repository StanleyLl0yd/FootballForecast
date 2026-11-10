import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM3SourceCrosschecks} from '../lib/m3-source-crosschecks.mjs';

const load=name=>JSON.parse(readFileSync(new URL('../../../docs/'+name,import.meta.url)));
const reference=[
  load('M3_SCORE_FREE_FIXTURE_GRAPH_EVIDENCE.json'),
  load('M3_FIVE_CC0_UTC_MINUTE_HISTOGRAM_EVIDENCE.json'),
  load('M3_TWO_SEASON_SIX_RFS_ANCHORS_EVIDENCE.json')
];
const read=()=>structuredClone(reference);

test('M3 owner-safe source receipts summarize only anonymous structural observations',()=>{
  const result=inspectM3SourceCrosschecks(...read());
  assert.deepEqual(result,{
    state:'corroborated',structurallyLinked:1200,publicClocked:1153,
    anonymousMinuteOverlaps:1116,missingPublicClocks:47,
    officialSpotAnchors:6,independentlyEligiblePrivateRows:0,
    m3A3Accepted:false,holdoutRead:false
  });
  assert.ok(Object.isFrozen(result));
  assert.doesNotMatch(JSON.stringify(result),/providerId|privateMatchId|scoreValue/);
});

test('source mismatch, receipt forgery and public-clock fabrication fail closed',()=>{
  const cases=[
    a=>{a[0].seasons[2].postConsistencyResolved=239;},
    a=>{a[0].sourceFiles[0].blobSha='0'.repeat(40);},
    a=>{a[0].graphTotals.initialReciprocalSeedSingletons=1200;},
    a=>{a[1].sourceRows[0].exactUtcMinuteOverlapCount=240;},
    a=>{a[1].aggregate.publicWithoutClock=0;},
    a=>{a[1].sourceRows[4].sourceFirstPublicationVerified=true;},
    a=>{a[2].summary.exactUtcMinuteCandidates=7;},
    a=>{a[2].events[5].exactMinuteOfficialScoreAgreements=0;},
    a=>{a[2].events[0].scheduledUtcFromMoscow='2021-07-24T15:30:00Z';},
    a=>{a[2].events[1].retrospectiveOfficialHomeGoals=3;},
    a=>{a[0].seasons[0].reciprocalSeedSingletons=208;
      a[0].seasons[0].initialAmbiguous=32;
      a[0].seasons[1].reciprocalSeedSingletons=220;
      a[0].seasons[1].initialAmbiguous=20;},
    a=>{a[2].administrativeResultWarning.privateRowCertifiedPlayedScore=true;}
  ];
  for(const change of cases){
    const a=read();change(a);
    assert.equal(inspectM3SourceCrosschecks(...a).state,'blocked');
  }
});

test('new data-rights, training or 2025/26 authorization claims fail closed',()=>{
  for(const [i,key] of [[0,'sourceTrainingRightsVerified'],[0,'realModelFitted'],
    [0,'heldoutDataRead'],[1,'realModelTrainingAuthorized'],
    [1,'holdout2025_26Read'],[2,'sourceFirstServingUtcVerified'],
    [2,'m3A3Accepted']]){
    const a=read();
    a[i].limitations[key]=true;
    assert.equal(inspectM3SourceCrosschecks(...a).state,'blocked',key);
  }
  const a=read(); a[0].gateStatus.m3A3Accepted=true;
  assert.equal(inspectM3SourceCrosschecks(...a).state,'blocked');
});

test('unexpected raw IDs, match records or extra schema keys fail closed',()=>{
  const cases=[
    a=>{a[0].sourceFiles[0].privateProviderId='NO_EXPORT';},
    a=>{a[0].seasons[0].privateMatchId=12;},
    a=>{a[1].sourceRows[0].privateMinuteBins=[1];},
    a=>{a[2].events[0].privateClubId=99;},
    a=>{a[2].privateRows=[{id:7}];}
  ];
  for(const change of cases){
    const a=read();change(a);
    assert.equal(inspectM3SourceCrosschecks(...a).state,'blocked');
  }
});

test('owner page must authorize before validating three public-safe receipts',()=>{
  const owner=readFileSync(new URL('../app/(console)/admin/research/page.tsx',import.meta.url),'utf8');
  const auth=owner.indexOf('await requireOwner()');
  const evidence=owner.indexOf('const m3Crosschecks=inspectM3SourceCrosschecks');
  assert.ok(auth>=0 && evidence>auth);
  assert.match(owner,/m3Crosschecks.state==='corroborated'/);
  assert.match(owner,/M3_SCORE_FREE_FIXTURE_GRAPH_EVIDENCE.json/);
  assert.match(owner,/M3_FIVE_CC0_UTC_MINUTE_HISTOGRAM_EVIDENCE.json/);
  assert.match(owner,/M3_TWO_SEASON_SIX_RFS_ANCHORS_EVIDENCE.json/);
  assert.match(owner,/m3Crosschecks.independentlyEligiblePrivateRows/);
  assert.match(owner,/M3-A3 остаётся открытым/);
  assert.doesNotMatch(owner,/fetch\s*\([^)]*m3Crosschecks|supabase\.from\(['"]ff_private/i);
});
