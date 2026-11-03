import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSevenSeasonSamples,HISTORICAL_SEASONS} from '../scripts/m2-openfoot-history-audit.mjs';

const AT='2026-11-03T12:00:00Z';
const makePages=()=>HISTORICAL_SEASONS.map(season=>({
  data:[{
    id:'match_'+season.slice(0,4),
    competitionId:'comp_premier_league_rus',season,status:'finished',
    kickoffAt:season.slice(0,4)+'-09-15T16:00:00Z',
    homeTeam:{id:'private_11'},awayTeam:{id:'private_22'}
  }],
  meta:{count:1,access:{authenticated:true,plan:'starter'},
    sources:[{name:'Restricted internal metadata',license:'Unknown'}]}
}));
const bad=fn=>{const pages=makePages();fn(pages);
  assert.throws(()=>auditSevenSeasonSamples(pages,AT),/refused/);};

test('development horizon is exactly seven seasons without the 2025/26 holdout',()=>{
  assert.deepEqual(HISTORICAL_SEASONS,[
    '2018/19','2019/20','2020/21','2021/22','2022/23','2023/24','2024/25'
  ]);
  const result=auditSevenSeasonSamples(makePages(),AT);
  assert.equal(result.requestsSent,7);
  assert.equal(result.seasonsWithSamples,7);
  assert.equal(result.observedSampleRows,7);
  assert.equal(result.expectedFixturesMaximum,1680);
  assert.equal(result.allSevenSeasonsVerified,false);
  assert.equal(result.completeSeasonsVerified,0);
  assert.equal(result.trainingApproved,false);
  assert.equal(result.holdoutRead,false);
  assert.doesNotMatch(JSON.stringify(result),/private_11|private_22|match_2018|Restricted internal/);
});
test('empty response and pagination never imply full-season coverage',()=>{
  const pages=makePages();
  pages[0].data=[];pages[0].meta.count=0;
  pages[1].meta.pagination={next_cursor:'paid'};
  const result=auditSevenSeasonSamples(pages,AT);
  assert.equal(result.developmentSeasons[0].coverageState,'UNKNOWN_EMPTY_SAMPLE');
  assert.equal(result.developmentSeasons[1].paginationRestricted,true);
  assert.equal(result.developmentSeasons[1].fullSeasonVerified,false);
});
test('refuse wrong tier, wrong season, data beyond sample size and duplicate IDs',()=>{
  bad(x=>{x[0].meta.access.plan='developer';});
  bad(x=>{x[0].data[0].season='2025/26';});
  bad(x=>{x[0].data[0].competitionId='other';});
  bad(x=>{x[1].meta.count=8;});
  bad(x=>{x[0].data.push({...x[0].data[0]});x[0].meta.count=2;});
  bad(x=>{x[0].data[0].kickoffAt='2025-09-15T16:00:00Z';});
  bad(x=>{x[0].data[0].homeTeam=x[0].data[0].awayTeam;});
  bad(x=>{x[0].data=Array.from({length:51},(_,i)=>({
    ...x[0].data[0],id:'match_'+i
  }));x[0].meta.count=51;});
  assert.throws(()=>auditSevenSeasonSamples(makePages().slice(0,6),AT),/refused/);
  assert.throws(()=>auditSevenSeasonSamples(makePages(),'2026-11-03T12:00:00+03:00'),/refused/);
});
test('workflow stays owner-only, free-tier, bounded, manual, and excludes holdout',()=>{
  const workflow=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=workflow.indexOf('  bounded-openfoot-seven-season-history:');
  assert.ok(start>0);
  const job=workflow.slice(start);
  for(const needle of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.openfoot_history == 'AUDIT_RPL_HISTORY'",
    "github.event.issue.number == 182",
    "github.event.comment.user.login == 'StanleyLl0yd'",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-history'",
    'OPENFOOT_API_KEY:', 'm2-openfoot-history-audit.mjs',
    '--max-redirs 0','--max-filesize 200000',
    '2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25',
    'persist-credentials: false'
  ])assert.ok(job.includes(needle),needle);
  assert.doesNotMatch(job,/2025\/26|2025%2F26|upload-artifact|git push|set -x|DATABASE_URL|[?&]cursor=/);
  assert.doesNotMatch(workflow,/^  (?:push|schedule|workflow_run):/m);
});
