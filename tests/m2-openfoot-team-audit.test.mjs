import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverTeams,auditTeamPages} from '../scripts/m2-openfoot-team-audit.mjs';

const AT='2026-11-03T12:00:00Z';
const season=()=>{
  const rotated=Array.from({length:15},(_,i)=>i+1),first=[];
  for(let k=0;k<15;k++){
    const teams=[0,...rotated];
    first.push(Array.from({length:8},(_,i)=>[teams[i],teams[15-i]]));
    rotated.unshift(rotated.pop());
  }
  const rows=[...first,...first.map(games=>games.map(([a,b])=>[b,a]))]
    .flatMap((matches,i)=>matches.map(([h,a])=>({
      id:'game_'+i+'_'+h+'_'+a,competitionId:'comp_premier_league_rus',
      season:'2026/27',status:i<12?'finished':'scheduled',
      kickoffAt:'2026-11-03T15:00:00.000Z',
      homeTeam:{id:'team_'+h,name:'PRIVATE'},awayTeam:{id:'team_'+a,name:'PRIVATE'}
    })));
  const meta=n=>({count:n,access:{authenticated:true,plan:'starter'},
    sources:[{name:'provider',license:'OPEN'}]});
  const seed={data:rows.slice(0,50),meta:meta(50)};
  const ids=discoverTeams(seed,AT);
  const pages=ids.map(team=>{
    const data=rows.filter(x=>x.homeTeam.id===team||x.awayTeam.id===team)
      .map(x=>structuredClone(x));
    return {data,meta:meta(data.length)};
  });
  return {seed,ids,pages};
};
test('16 free club views establish complete structural source coverage, not approval',()=>{
  const {ids,pages}=season(),r=auditTeamPages(ids,pages,AT);
  assert.equal(ids.length,16);
  assert.equal(r.uniqueMatchesObserved,240);
  assert.equal(r.crossConfirmedUniqueMatches,240);
  assert.equal(r.rowsAcrossTeamPages,480);
  assert.equal(r.coverageState,'STRUCTURALLY_COMPLETE_UNAPPROVED');
  assert.equal(r.readyForIndependentQualityReview,true);
  assert.equal(r.fullRplSeasonApproved,false);
  assert.equal(r.holdoutRead,false);
  assert.doesNotMatch(JSON.stringify(r),/team_\d|PRIVATE|game_/);
});
test('missing future games are partial',()=>{
  const {ids,pages}=season();
  for(const page of pages){
    page.data=page.data.filter(x=>x.status==='finished');
    page.meta.count=page.data.length;
  }
  const result=auditTeamPages(ids,pages,AT);
  assert.ok(result.uniqueMatchesObserved<240);
  assert.equal(result.coverageState,'PARTIAL_UNAPPROVED');
  assert.equal(result.readyForIndependentQualityReview,false);
});
test('paid tier, duplicate, tampered cross-club match and wrong season fail closed',()=>{
  const reject=fn=>{const {ids,pages}=season();fn(ids,pages);
    assert.throws(()=>auditTeamPages(ids,pages,AT),/refused/);};
  reject((_,p)=>p[0].meta.access.plan='developer');
  reject((_,p)=>p[0].data[0].competitionId='other');
  reject((_,p)=>p[0].meta.count=50);
  reject((_,p)=>p[0].data[0].awayTeam.id='team_external');
  reject((_,p)=>p[0].data[0].kickoffAt='2025-01-01T00:00:00Z');
  reject((_,p)=>p[0].data.push(p[0].data[0]));
  reject((_,p)=>p[0].data[0].homeGoals=99);
});
test('paid cursor and degraded upstream stay INCONCLUSIVE',()=>{
  const {ids,pages}=season();
  pages[0].meta.pagination={next_cursor:'paid-only'};
  assert.equal(auditTeamPages(ids,pages,AT).coverageState,'INCONCLUSIVE_RESTRICTED_PAGINATION');
  pages[0].meta.pagination=null;
  pages[0].meta.unavailable={reason:'upstream'};
  assert.equal(auditTeamPages(ids,pages,AT).coverageState,'INCONCLUSIVE_UNAVAILABLE');
  pages[0].meta.unavailable={};
  pages[0].meta.scope={window:{start:'2026-10-01',end:'2026-10-08'}};
  assert.equal(auditTeamPages(ids,pages,AT).coverageState,'INCONCLUSIVE_SCOPE_WINDOW');
});
test('initial team IDs require validated provider competition and free tier',()=>{
  const {seed}=season();
  seed.data[0].competitionId='wrong';
  assert.throws(()=>discoverTeams(seed,AT),/refused|diagnostic/);
});
test('team filter probe can run only under owner gate without leaks or paid cursor',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('  bounded-openfoot-free-teams:');
  assert.ok(start>0);
  const job=workflow.slice(start);
  const secretVar='OPENFOOT_API_KEY: $'+'{{ secrets.OPENFOOT_API_KEY }}';
  for(const needle of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.openfoot_teams == 'AUDIT_OPENFOOT_TEAMS'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-teams'",
    secretVar,'m2-openfoot-team-audit.mjs','--max-redirs 0',
    'season=2026%2F27&team=$team_id',
    'INCONCLUSIVE_SEED_SCOPE','INCONCLUSIVE_TEAM_FILTER_',
    'persist-credentials: false','timeout-minutes: 8'
  ])assert.ok(job.includes(needle),needle);
  assert.doesNotMatch(job,/[?&]cursor=|--location|curl -L|upload-artifact|git push|DATABASE_URL|set -x|psql /);
});
