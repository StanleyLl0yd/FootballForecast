import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeOpenFootRpl,OPENFOOT_RPL} from '../scripts/m2-openfoot-rpl-diagnostic.mjs';
const now='2026-11-03T09:00:00Z';
const fixture=(h='team_h',a='team_a')=>({
  id:'game_'+h+'_'+a,competitionId:OPENFOOT_RPL.competition,
  status:'scheduled',kickoffAt:'2026-11-07T15:00:00.000Z',
  homeTeam:{id:h,name:'private home'},awayTeam:{id:a,name:'private away'}
});
const payload=()=>({data:[fixture()],meta:{count:1,sources:[{name:'source',license:'open'}]}});
const bad=fn=>{const v=payload();fn(v);assert.throws(()=>summarizeOpenFootRpl(v,now),/refused/);};
test('one demo fixture remains partial, without authorizing publication or exposing records',()=>{
  const v=summarizeOpenFootRpl(payload(),now);
  assert.equal(v.coverageState,'PARTIAL_UNAPPROVED');
  assert.equal(v.withUtcKickoff,1);
  assert.equal(v.sourceLicenseMetadataPresent,true);
  assert.equal(v.productionIngestionApproved,false);
  assert.equal(v.fullRplSeasonApproved,false);
  assert.equal(v.holdoutRead,false);
  assert.equal(v.forecastsPublished,0);
  assert.equal(JSON.stringify(v).includes('private home'),false);
  assert.equal(JSON.stringify(v).includes('game_'),false);
});
test('empty or explicitly unavailable sample is inconclusive, not zero league fixtures',()=>{
  const e=summarizeOpenFootRpl({data:[],meta:{count:0}},now);
  assert.equal(e.coverageState,'INCONCLUSIVE_EMPTY');
  const u=summarizeOpenFootRpl({
    data:[],meta:{count:0,unavailable:{comp_premier_league_rus:'not available'}}
  },now);
  assert.equal(u.coverageState,'INCONCLUSIVE_UNAVAILABLE');
});
test('wrong competition, season, identities, duplicated and invalid timestamps refused',()=>{
  bad(x=>{x.data[0].competitionId='comp_premier_league_eng'});
  bad(x=>{x.data[0].season='2025/26'});
  bad(x=>{x.data[0].homeTeam.id=x.data[0].awayTeam.id});
  bad(x=>{x.data[0].kickoffAt='2026-11-07T15:00:00+03:00'});
  bad(x=>{x.data[0].kickoffAt='2025-11-07T15:00:00Z'});
  bad(x=>{x.data[0].status='awarded'});
  bad(x=>{x.data.push(structuredClone(x.data[0]))});
  bad(x=>{x.meta.count=-1});
  bad(x=>{x.meta.scope={window:{start:'2026-11-01',end:'2026-11-08X'}}});
  assert.throws(()=>summarizeOpenFootRpl(payload(),'invalid'),/refused/);
  assert.throws(()=>summarizeOpenFootRpl({error:{code:'source_unavailable'}},now),/refused/);
});
test('synthetic 240/16 season structure still cannot approve a source',()=>{
  const games=[];
  for(let h=0;h<16;h++)for(let a=0;a<16;a++)
    if(h!==a)games.push(fixture('club_'+h,'club_'+a));
  const complete=summarizeOpenFootRpl({data:games,meta:{count:240}},now);
  assert.equal(complete.coverageState,'STRUCTURALLY_COMPLETE_UNAPPROVED');
  assert.equal(complete.distinctClubsObserved,16);
  assert.equal(complete.fullRplSeasonApproved,false);
  assert.equal(complete.productionIngestionApproved,false);
  const narrowed=summarizeOpenFootRpl({
    data:games,meta:{count:240,scope:{window:{start:'2026-11-01',end:'2026-11-07'}}}
  },now);
  assert.equal(narrowed.coverageState,'PARTIAL_UNAPPROVED');
});

test('free OpenFoot demo job is owner/main-only and cannot authorize ingestion',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('  bounded-openfoot-rpl-demo:');
  assert.ok(start>0);
  const job=workflow.slice(start);
  for(const constraint of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-public-sources'",
    'persist-credentials: false',
    'timeout-minutes: 5',
    'demo-curl.conf',
    "'of_demo_' 'openfootapi_docs'",
    'competition=comp_premier_league_rus&season=2026%2F27',
    'node scripts/m2-openfoot-rpl-diagnostic.mjs',
    "status" // only checked as literal sentinel
  ])assert.ok(job.includes(constraint),constraint);
  assert.doesNotMatch(job,/secrets\.|psql |SUPABASE|DATABASE_URL|upload-artifact|git push|--location|curl -L|npm install|FF_M1_DB_WRITE_ENABLED/);
  assert.match(workflow,/^on:\n  workflow_dispatch:\n  issue_comment:/m);
  assert.doesNotMatch(workflow,/^  (?:push|schedule|workflow_run):/m);
});

test('manual source workflow outputs only the existing safe aggregates to job logs',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  for(const marker of [
    'M2_OPENFOOTBALL_OBSERVATION=',
    'M2_SPORTSCORE_OBSERVATION=INCONCLUSIVE_SEARCH',
    'M2_SPORTSCORE_OBSERVATION=INCONCLUSIVE_DAY',
    'M2_SPORTSCORE_OBSERVATION=INCONCLUSIVE_COMPETITION',
    'M2_SPORTSCORE_OBSERVATION=$(cat',
    'M2_OPENFOOT_OBSERVATION=INCONCLUSIVE_HTTP',
    'M2_OPENFOOT_OBSERVATION=INCONCLUSIVE_SCHEMA',
    'M2_OPENFOOT_OBSERVATION=$(cat'
  ])assert.ok(workflow.includes(marker),marker);
  assert.doesNotMatch(workflow,/cat "\$work\/(?:day|search|openfootball)\.(?:json|txt)"/);
  assert.doesNotMatch(workflow,/upload-artifact|FF_M1_DB_WRITE_ENABLED|psql |secrets\./);
});
