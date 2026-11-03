import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectM2PublicSourceObservations} from '../lib/m2-public-source-evidence.mjs';
const evidence=JSON.parse(readFileSync(new URL(
  '../../../docs/M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json',import.meta.url),'utf8'));
const modify=fn=>{const copy=structuredClone(evidence);fn(copy);return copy;};
test('observed exact protected-run source aggregates are explicitly non-authorizing',()=>{
 const r=inspectM2PublicSourceObservations(evidence);
 assert.equal(r.state,'recorded');
 assert.equal(r.runId,41613346756);
 assert.equal(r.openFootball.matches,240);
 assert.equal(r.openFoot.matches,5);
 assert.equal(r.openFoot.coverage,'PARTIAL_UNAPPROVED');
 assert.equal(r.sportScore.matches,0);
 assert.equal(r.sportScore.coverage,'NO_VERIFIED_CURRENT_DAY_RPL_OBSERVATIONS');
 assert.equal(evidence.gate.liveSourceApproved,false);
 assert.equal(evidence.gate.holdoutRead,false);
 assert.equal(evidence.gate.modelApproved,false);
 assert.equal(evidence.gate.publishedForecasts,0);
 for(const forbidden of ['homeTeam','awayTeam','privateRows','apiKey','bearer',
    'matchId','homeGoals','awayGoals','trainingModel']){
   assert.equal(JSON.stringify(evidence).includes(forbidden),false,forbidden);
 }
});
test('substituted job/source/fixture counts, approval, extra fields rejected',()=>{
 const bad=[
  modify(x=>x.run.headSha='f'.repeat(40)),
  modify(x=>x.run.jobs[0].id=1),
  modify(x=>x.run.jobs[2].conclusion='skipped'),
  modify(x=>x.observations.openFoot.matchesObserved=240),
  modify(x=>x.observations.openFoot.coverageState='VERIFIED'),
  modify(x=>x.observations.openFoot.sourceResponseSha256='a'.repeat(64)),
  modify(x=>x.observations.openFootball.fixtures=239),
  modify(x=>x.observations.openFootball.sourceBytesSha256='f'.repeat(64)),
  modify(x=>x.observations.sportScore.completeDayVerified=true),
  modify(x=>x.observations.sportScore.dateUtc='2026-11-04'),
  modify(x=>x.gate.liveSourceApproved=true),
  modify(x=>x.gate.holdoutRead=true),
  modify(x=>x.observations.openFoot.teamNames=['private']),
  modify(x=>x.run.jobs.push(x.run.jobs[0])),
  modify(x=>x.unexpected='value')
 ];
 for(const data of bad)assert.equal(inspectM2PublicSourceObservations(data).state,'invalid');
 assert.equal(inspectM2PublicSourceObservations(null).state,'invalid');
});
test('research viewer authenticates owner before inspecting evidence and has no admin writes',()=>{
 const page=readFileSync(new URL('../app/(console)/admin/research/page.tsx',
  import.meta.url),'utf8');
 const auth=page.indexOf('await requireOwner()');
 assert.ok(auth>0&&auth<page.indexOf('inspectM2PublicSourceObservations('));
 assert.match(page,/M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE\.json/);
 assert.match(page,/PARTIAL_UNAPPROVED|не подтвержден|Не подтвержден/);
 assert.doesNotMatch(page,/database\.insert|service_role|createClient\s*\(/);
});
