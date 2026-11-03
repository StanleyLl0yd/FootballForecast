import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
  normalizePrivateSeason,makePrivateHistoryDocument
} from '../scripts/m2-private-rpl-history-normalize.mjs';

function fixturePages(season){
  const rotated=Array.from({length:15},(_,i)=>i+1),pairs=[];
  for(let round=0;round<15;round++){
    const clubs=[0,...rotated];
    for(let i=0;i<8;i++)pairs.push([clubs[i],clubs[15-i]]);
    rotated.unshift(rotated.pop());
  }
  const rows=[...pairs,...pairs.map(([a,b])=>[b,a])].map(([home,away],i)=>({
    id:'synthetic_'+i,competitionId:'comp_premier_league_rus',
    season,status:'finished',kickoffAt:season.slice(0,4)+'-09-15T12:00:00Z',
    homeTeam:{id:'club_'+home},awayTeam:{id:'club_'+away},
    score:{home:i%4,away:i%3}
  }));
  const page=items=>({data:items,meta:{count:items.length,
    access:{authenticated:true,plan:'starter'},
    sources:[{name:'Synthetic provider',license:'Synthetic'}]}});
  const seed=page(rows.slice(0,50));
  const ids=[...new Set(seed.data.flatMap(x=>[x.homeTeam.id,x.awayTeam.id]))].sort();
  const pages=ids.map(id=>page(rows.filter(x=>x.homeTeam.id===id||x.awayTeam.id===id)));
  const hashes=Array.from({length:17},(_,i)=>createHash('sha256')
    .update('synthetic'+i).digest('hex'));
  return {seed,pages,hashes};
}
test('normalizes verified source rows privately with deterministic canonical digest',()=>{
  const {seed,pages,hashes}=fixturePages('2018/19');
  const s=normalizePrivateSeason(seed,pages,'2018/19',hashes);
  assert.equal(s.season,'2018/19');
  assert.equal(s.fixtures.length,240);
  const keys=Object.keys(s.fixtures[0]);
  assert.deepEqual(keys,['awayGoals','awayTeamId','homeGoals','homeTeamId','kickoffAt','sourceMatchId']);
  assert.match(s.normalizedRowsSha256,/^[a-f0-9]{64}$/);
  assert.equal(s.normalizedRowsSha256,createHash('sha256')
    .update(JSON.stringify(s.fixtures)).digest('hex'));
  assert.deepEqual(s,normalizePrivateSeason(seed,pages,'2018/19',hashes));
});
test('seven-season document cannot include sealed holdout or unspecified sources',()=>{
  const years=Array.from({length:7},(_,i)=>{
    const y=2018+i;return String(y)+'/'+String((y+1)%100).padStart(2,'0');
  });
  const seasons=years.map(season=>{
    const {seed,pages,hashes}=fixturePages(season);
    return normalizePrivateSeason(seed,pages,season,hashes);
  });
  const d=makePrivateHistoryDocument(seasons,'2026-11-03T15:30:00Z','a'.repeat(40),1234);
  assert.equal(d.seasons.length,7);
  assert.equal(d.seasons.reduce((n,s)=>n+s.fixtures.length,0),1680);
  assert.equal(d.researchRole,'development_source_only');
  assert.throws(()=>makePrivateHistoryDocument(
    [{...seasons[0],season:'2025/26'},...seasons.slice(1)],
    d.observedAtUtc,d.codeSha,d.runId),/refused/);
});
test('source contradictions, missing score and incomplete pages never produce private data',()=>{
  let x=fixturePages('2024/25');
  x.pages[0].data.pop();x.pages[0].meta.count--;
  assert.throws(()=>normalizePrivateSeason(x.seed,x.pages,'2024/25',x.hashes),/refused/);
  x=fixturePages('2024/25');x.pages[0].data[0].score.home=99;
  assert.throws(()=>normalizePrivateSeason(x.seed,x.pages,'2024/25',x.hashes),/refused/);
  x=fixturePages('2024/25');x.pages[0].meta.pagination={next_cursor:'paid'};
  assert.throws(()=>normalizePrivateSeason(x.seed,x.pages,'2024/25',x.hashes),/refused/);
  x=fixturePages('2024/25');x.pages[0].data[0].status='awarded';
  assert.throws(()=>normalizePrivateSeason(x.seed,x.pages,'2024/25',x.hashes),/refused/);
});
test('private import workflow cannot run without owner, protected env and exact confirmation',()=>{
  const yaml=readFileSync(new URL(
    '../.github/workflows/m2-private-rpl-history-import.yml',import.meta.url),'utf8');
  const shell=readFileSync(new URL(
    '../scripts/m2-private-rpl-history-run.sh',import.meta.url),'utf8');
  const joint=yaml+'\n'+shell;
  for(const item of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.confirmation == 'STORE_RPL_SEVEN_SEASONS_PRIVATE'",
    "github.event.issue.number == 182",
    "!github.event.issue.pull_request",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-private-rpl-history'",
    'environment: m1-source-import',
    "python -m pip install -e 'ml[test]' 'psycopg[binary]==3.3.6'",
    'OPENFOOT_API_KEY: $'+'{{ secrets.OPENFOOT_API_KEY }}',
    '2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25',
    'sleep 1.2','PGSSLMODE: verify-full','persist-credentials: false',
    'm2-private-rpl-history-normalize.mjs',
    'football_forecast.data.rpl_private_history',
    '--max-redirs 0','--max-filesize 200000'
  ])assert.ok(joint.includes(item),item);
  assert.doesNotMatch(joint,/2025\/26|2025%2F26|upload-artifact|git push|set -x|[?&]cursor=|curl -L/);
  assert.doesNotMatch(yaml,/^  (?:push|schedule|workflow_run):/m);
});
