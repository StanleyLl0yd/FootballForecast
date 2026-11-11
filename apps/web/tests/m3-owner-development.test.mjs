import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {inspectM3OwnerDevelopment} from '../lib/m3-owner-development.mjs';

const load=file=>JSON.parse(readFileSync(new URL('../../../docs/'+file,import.meta.url)));
const a3=load('M3_A3_SEVEN_SEASON_RETROSPECTIVE_READINESS_2026-11-11.json');
const study=load('M3_A4_A5_A6_REAL_DEVELOPMENT_2026-11-11.json');
const copy=()=>[structuredClone(a3),structuredClone(study)];
const owner=readFileSync(new URL('../app/(console)/admin/research/page.tsx',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../components/m3-development-workbench.tsx',import.meta.url),'utf8');

test('M3 owner viewer uses independently verified real aggregate-only results',()=>{
  const result=inspectM3OwnerDevelopment(...copy());
  assert.equal(result.state,'verified_retrospective');
  assert.equal(result.acceptedTechnicalGates,8);
  assert.equal(result.totalCorrespondences,1680);
  assert.equal(result.playedCandidates,1673);
  assert.equal(result.excluded,7);
  assert.equal(result.seasons.length,7);
  assert.equal(result.folds.length,5);
  assert.equal(result.folds.reduce((sum,x)=>sum+x.scoredN,0),1197);
  assert.deepEqual(result.folds.map(x=>x.scoredN),[238,240,239,240,240]);
  assert.ok(result.folds.every(x=>x.baseline.logLoss>x.poisson.logLoss));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.folds));
  assert.ok(Object.isFrozen(result.folds[0]));
  assert.equal(result.strictAsOf,false);
  assert.equal(result.productionApproved,false);
  assert.equal(Object.hasOwn(result,'rawMatches'),false);
  assert.equal(result.links.developmentDigest.length,64);
  assert.equal(result.links.correlationDigest.length,64);
});

test('forged source, metrics, exclusions, signatures and holdout access fail closed',()=>{
  const mutations=[
    x=>{x[0].totals.scoreFreeGraphMatches=1679;},
    x=>{x[0].totals.retrospectivePlayedScoreCandidates=1680;},
    x=>{x[0].perSeason[3].knownAdministrativeOrRevisedExcluded=1;},
    x=>{x[0].references[2].matched=479;},
    x=>{x[0].references[2].aggregateSha256='f'.repeat(64);},
    x=>{x[0].exclusions[6].playedScore='0:3';},
    x=>{x[0].scope.holdout2025_26Read=true;},
    x=>{x[0].scope.historicalStrictAsOfClaim=true;},
    x=>{x[1].protectedReceipt.candidateScoredMatches=1200;},
    x=>{x[1].protectedReceipt.aggregateResultsSha256='a'.repeat(64);},
    x=>{x[1].folds[3].trainN=240;},
    x=>{x[1].folds[4].poissonLogLoss='1.999999';},
    x=>{x[1].folds[0].abstainedN=0;},
    x=>{x[1].limitations.bookmakerOutperformanceClaim=true;},
    x=>{x[1].limitations.consumedHoldout2025_26Access=true;},
    x=>{x[1].gates.publicReleaseAuthorized=true;},
  ];
  for(const mutate of mutations){
    const payload=copy();mutate(payload);
    assert.equal(inspectM3OwnerDevelopment(...payload).state,'blocked');
  }
});

test('owner gate precedes inspection, and UI provides read-only model/metric choices',()=>{
  const auth=owner.indexOf('await requireOwner()');
  const inspect=owner.indexOf('const m3Development=inspectM3OwnerDevelopment');
  assert.ok(auth>=0&&inspect>auth);
  assert.match(owner,/M3DevelopmentWorkbench summary=\{m3Development\}/);
  assert.match(owner,/Архив диагностики M3/);
  assert.match(viewer,/id="m3-model-choice"/);
  assert.match(viewer,/id="m3-metric-choice"/);
  assert.match(viewer,/NON_STRICT_RETROSPECTIVE/);
  assert.match(viewer,/summary\.folds\.map/);
  assert.match(viewer,/summary\.seasons\.map/);
  assert.doesNotMatch(viewer,/fetch\s*\(|supabase|service_role|INSERT INTO|eval\s*\(/i);
});
