import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditScoreShape} from '../scripts/m2-openfoot-score-shape.mjs';
const AT='2026-11-03T14:00:00Z';
const fixture=(score)=>({
  data:Array.from({length:50},(_,i)=>({
    id:'private_match_'+i,competitionId:'comp_premier_league_rus',
    season:'2018/19',status:'finished',homeTeam:{id:'home_'+i},
    awayTeam:{id:'away_'+i},score
  })),
  meta:{count:50,access:{authenticated:true,plan:'starter'}}
});
test('counts nested pair shapes without exposing scores or identities',()=>{
  const result=auditScoreShape(fixture({home:2,away:1}),AT);
  assert.equal(result.numericGoalPairCandidates.scoreHomeAway,50);
  assert.equal(result.numericGoalPairCandidates.topLevelGoals,0);
  assert.equal(result.scoreObjectRows,50);
  assert.equal(result.exactFinalScoreSchemaVerified,false);
  assert.equal(result.holdoutRead,false);
  assert.doesNotMatch(JSON.stringify(result),/private_match|home_0|away_0/);
});
test('detects fullTime nested score separately, not by guessing',()=>{
  const result=auditScoreShape(fixture({fullTime:{home:1,away:0}}),AT);
  assert.equal(result.numericGoalPairCandidates.scoreFullTimeHomeAway,50);
  assert.equal(result.numericGoalPairCandidates.scoreHomeAway,0);
});
test('nullable or malformed score never becomes a numeric result',()=>{
  const empty=auditScoreShape(fixture(null),AT);
  assert.equal(empty.scoreNullRows,50);
  assert.ok(Object.values(empty.numericGoalPairCandidates).every(v=>v===0));
  const malformed=auditScoreShape(fixture({home:'2',away:1}),AT);
  assert.ok(Object.values(malformed.numericGoalPairCandidates).every(v=>v===0));
});
test('rejects wrong season, access tier, excess page, duplicate match',()=>{
  const bad=fn=>{const data=fixture({home:2,away:1});fn(data);
    assert.throws(()=>auditScoreShape(data,AT),/refused/);};
  bad(x=>x.meta.access.plan='developer');
  bad(x=>x.data[0].season='2025/26');
  bad(x=>x.data[0].id=x.data[1].id);
  bad(x=>{x.data.push(x.data[0]);x.meta.count=51;});
  assert.throws(()=>auditScoreShape(fixture(null),'2026-11-03T14:00:00+03:00'),/refused/);
});
test('the one-shot source probe is owner-only and cannot read sealed season or publish data',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const ix=workflow.indexOf('  bounded-openfoot-score-shape:');
  assert.ok(ix>0);
  const job=workflow.slice(ix);
  for(const s of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.actor == 'StanleyLl0yd'",
    "github.ref == 'refs/heads/main'",
    "inputs.openfoot_score_shape == 'AUDIT_RPL_SCORE_SHAPE'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-score-shape'",
    "OPENFOOT_API_KEY: $"+'{{ secrets.OPENFOOT_API_KEY }}',
    'season=2018%2F19',
    'm2-openfoot-score-shape.mjs',
    '--max-filesize 200000','--max-redirs 0','persist-credentials: false'
  ])assert.ok(job.includes(s),s);
  assert.doesNotMatch(job,/2025\/26|2025%2F26|upload-artifact|git push|DATABASE_URL|[?&]cursor=|set -x/);
});
