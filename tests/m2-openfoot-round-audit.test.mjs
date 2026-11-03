import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditOpenFootRounds,ROUNDS} from '../scripts/m2-openfoot-round-audit.mjs';

const AT='2026-11-03T12:00:00Z';
const season=()=>{
  const rotated=Array.from({length:15},(_,i)=>i+1);
  const first=[];
  for(let round=0;round<15;round++){
    const teams=[0,...rotated];
    first.push(Array.from({length:8},(_,i)=>[teams[i],teams[15-i]]));
    rotated.unshift(rotated.pop());
  }
  return [...first,...first.map(games=>games.map(([a,b])=>[b,a]))]
    .map((games,round)=>({
      data:games.map(([home,away])=>({
        id:'r'+(round+1)+'_'+home+'_'+away,
        competitionId:'comp_premier_league_rus',season:'2026/27',
        status:round<12?'finished':'scheduled',
        kickoffAt:'2026-11-07T15:00:00.000Z',
        homeTeam:{id:'club_'+home,name:'PRIVATE home'},
        awayTeam:{id:'club_'+away,name:'PRIVATE away'}
      })),
      meta:{count:8,access:{authenticated:true,plan:'starter'},
        sources:[{name:'Provider',license:'OPEN'}]}
    }));
};
const bad=fn=>{const rows=season();fn(rows);assert.throws(()=>auditOpenFootRounds(rows,AT),/refused/);};

test('explicit 30-round free audit stays aggregate-only and not approved',()=>{
  const result=auditOpenFootRounds(season(),AT);
  assert.equal(ROUNDS,30);
  assert.equal(result.coverageState,'STRUCTURALLY_COMPLETE_UNAPPROVED');
  assert.equal(result.matchesObserved,240);
  assert.equal(result.distinctClubsObserved,16);
  assert.equal(result.roundsWithEightMatches,30);
  assert.equal(result.roundsWithSixteenClubs,30);
  assert.equal(result.declaredUtcKickoffs,240);
  assert.equal(result.sourceMetadataResponses,30);
  assert.equal(result.readyForIndependentQualityReview,true);
  assert.equal(result.fullRplSeasonApproved,false);
  assert.equal(result.productionIngestionApproved,false);
  assert.equal(result.holdoutRead,false);
  assert.equal(result.privateRecordsPersisted,false);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|club_\d|r1_0_/);
});
test('missing future rounds remain partial, not full-season coverage',()=>{
  const rows=season();
  for(let i=8;i<30;i++){rows[i].data=[];rows[i].meta.count=0;}
  const result=auditOpenFootRounds(rows,AT);
  assert.equal(result.matchesObserved,64);
  assert.equal(result.roundsWithNoMatches,22);
  assert.equal(result.coverageState,'PARTIAL_UNAPPROVED');
  assert.equal(result.readyForIndependentQualityReview,false);
});
test('wrong tier, bad count, duplicate records and out-of-season inputs fail closed',()=>{
  bad(x=>x[0].meta.access={authenticated:true,plan:'developer'});
  bad(x=>x[1].meta.count=50);
  bad(x=>x[1].data=x[0].data);
  bad(x=>x[0].data[1].homeTeam.id=x[0].data[0].homeTeam.id);
  bad(x=>x[3].data[0].competitionId='other');
  bad(x=>x[3].data[0].status='pending');
  bad(x=>x[2].data[0].kickoffAt='2026-11-07T15:00:00+03:00');
  bad(x=>x[2].data[0].season='2025/26');
  bad(x=>x[0].data[0].awayTeam.id=x[0].data[0].homeTeam.id);
  bad(x=>x[2].data[0].kickoffAt='2025-11-07T15:00:00.000Z');
  assert.throws(()=>auditOpenFootRounds([],AT),/refused/);
  assert.throws(()=>auditOpenFootRounds(season(),'2026-11-03T12:00:00+00:00'),/refused/);
});
test('paid pagination, unavailable feed and default time window remain inconclusive',()=>{
  const rows=season();rows[0].meta.pagination={next_cursor:'restricted'};
  let result=auditOpenFootRounds(rows,AT);
  assert.equal(result.coverageState,'INCONCLUSIVE_RESTRICTED_PAGINATION');
  assert.equal(result.readyForIndependentQualityReview,false);
  rows[0].meta.pagination=null;
  rows[0].meta.unavailable={comp_premier_league_rus:'not available'};
  result=auditOpenFootRounds(rows,AT);
  assert.equal(result.coverageState,'INCONCLUSIVE_SOURCE_UNAVAILABLE');
  rows[0].meta.unavailable={};
  rows[0].meta.scope={window:{start:'2026-11-01',end:'2026-11-08'}};
  result=auditOpenFootRounds(rows,AT);
  assert.equal(result.coverageState,'INCONCLUSIVE_SCOPE_WINDOW');
});
test('owner round probe cannot use paid cursor or upload/log raw rows',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('  bounded-openfoot-free-rounds:');
  assert.ok(start>0);
  const job=workflow.slice(start);
  const secretVar='OPENFOOT_API_KEY: $'+'{{ secrets.OPENFOOT_API_KEY }}';
  for(const needle of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "github.event_name == 'workflow_dispatch'",
    "inputs.openfoot_rounds == 'AUDIT_OPENFOOT_ROUNDS'",
    "github.event.issue.number == 182",
    "!github.event.issue.pull_request",
    "github.event.comment.user.login == 'StanleyLl0yd'",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-rounds'",
    secretVar,'m2-openfoot-round-audit.mjs','--max-redirs 0',
    'season=2026%2F27&round=$round',
    'INCONCLUSIVE_NO_FREE_KEY','INCONCLUSIVE_HTTP_ROUND_',
    'persist-credentials: false','timeout-minutes: 8'
  ])assert.ok(job.includes(needle),needle);
  assert.doesNotMatch(job,/[?&]cursor=|--location|curl -L|upload-artifact|git push|DATABASE_URL|set -x|psql /);
  assert.match(workflow,/^  workflow_dispatch:\n    inputs:\n/m);
  assert.doesNotMatch(workflow,/^  (?:push|schedule|workflow_run):/m);
});
