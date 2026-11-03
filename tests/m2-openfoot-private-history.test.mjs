import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {preparePrivateHistoryArchive} from '../scripts/m2-openfoot-private-history-validate.mjs';
import {discoverSeasonTeams} from '../scripts/m2-openfoot-seven-season-full-audit.mjs';
import {HISTORICAL_SEASONS} from '../scripts/m2-openfoot-history-audit.mjs';

const SHA='a'.repeat(40),AT='2026-11-03T16:00:00Z',RUN=123456789;
const makeSeason=season=>{
  const rotated=Array.from({length:15},(_,i)=>i+1);
  const pairs=[];
  for(let round=0;round<15;round++){
    const slots=[0,...rotated];
    for(let j=0;j<8;j++)pairs.push([slots[j],slots[15-j]]);
    rotated.unshift(rotated.pop());
  }
  const rows=[...pairs,...pairs.map(([a,b])=>[b,a])].map(([a,b],i)=>({
    id:'synthetic_'+season.slice(0,4)+'_'+i,competitionId:'comp_premier_league_rus',
    season,status:'finished',kickoffAt:season.slice(0,4)+'-09-15T16:00:00Z',
    homeTeam:{id:'club_'+a,name:'PRIVATE TEAM LABEL'},
    awayTeam:{id:'club_'+b,name:'PRIVATE TEAM LABEL'},
    score:{home:i%4,away:i%3}
  }));
  const page=data=>({data,meta:{count:data.length,access:{authenticated:true,plan:'starter'},
    sources:[{name:'PRIVATE PROVIDER NAME',license:'Unverified'}]}});
  const seed=page(rows.slice(0,50));
  const ids=discoverSeasonTeams(seed,season);
  const pages=ids.map(id=>page(rows.filter(r=>
    r.homeTeam.id===id||r.awayTeam.id===id)));
  const stringify=x=>Buffer.from(JSON.stringify(x));
  return {season,seed:stringify(seed),pages:pages.map(stringify)};
};
const corpus=()=>HISTORICAL_SEASONS.map(makeSeason);
const prepare=x=>preparePrivateHistoryArchive(x,SHA,RUN,AT);
test('seven synthetic double-round-robin seasons create a private canonical batch',()=>{
  const result=prepare(corpus());
  assert.equal(result.manifest.seasons,7);
  assert.equal(result.manifest.matches,1680);
  assert.equal(result.manifest.holdoutRead,false);
  assert.equal(result.manifest.modelTrainingApproved,false);
  assert.equal(result.manifest.publicRowsWritten,0);
  assert.equal(createHash('sha256').update(result.privateRecords).digest('hex'),
    result.manifest.normalizedSha256);
  const lines=result.privateRecords.toString('utf8').trimEnd().split('\n');
  assert.equal(lines.length,1680);
  assert.deepEqual(JSON.parse(lines[0]).season,'2018/19');
  assert.deepEqual(JSON.parse(lines.at(-1)).season,'2024/25');
  assert.doesNotMatch(JSON.stringify(result.manifest),
    /club_1|PRIVATE PROVIDER|PRIVATE TEAM|synthetic_/);
});
test('archive normalized bytes and hashes are deterministic',()=>{
  const a=prepare(corpus()),b=prepare(corpus());
  assert.equal(a.manifest.normalizedSha256,b.manifest.normalizedSha256);
  assert.equal(a.manifest.sourceResponsesSha256,b.manifest.sourceResponsesSha256);
  assert.equal(Buffer.compare(a.privateRecords,b.privateRecords),0);
});
test('missing nested scores, wrong season, paid tier and incomplete club views refuse',()=>{
  const bad=fn=>{const x=corpus();fn(x);
    assert.throws(()=>prepare(x),/failed|refused/);};
  bad(x=>{const d=JSON.parse(x[0].pages[0]);d.data[0].score={home:99,away:0};
    x[0].pages[0]=Buffer.from(JSON.stringify(d));});
  bad(x=>{const d=JSON.parse(x[1].pages[0]);d.data[0].season='2025/26';
    x[1].pages[0]=Buffer.from(JSON.stringify(d));});
  bad(x=>{const d=JSON.parse(x[2].pages[0]);d.meta.access.plan='developer';
    x[2].pages[0]=Buffer.from(JSON.stringify(d));});
  bad(x=>{const d=JSON.parse(x[3].pages[0]);d.data.pop();d.meta.count--;
    x[3].pages[0]=Buffer.from(JSON.stringify(d));});
  bad(x=>{const d=JSON.parse(x[4].pages[0]);d.data[0].kickoffAt='2026-11-03T18:00:00Z';
    x[4].pages[0]=Buffer.from(JSON.stringify(d));});
});
test('protected job has owner/branch/environment gates and no paid cursor or artifact upload',()=>{
  const w=readFileSync(new URL(
    '../.github/workflows/m2-openfoot-private-history.yml',import.meta.url),'utf8');
  const sh=readFileSync(new URL(
    '../scripts/m2-openfoot-private-history-run.sh',import.meta.url),'utf8');
  for(const needle of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.confirmation == 'ARCHIVE_PRIVATE_SEVEN_SEASONS'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-private-archive'",
    'environment: m1-source-import',
    'permissions: {contents: read}',
    'persist-credentials: false',
    'OPENFOOT_API_KEY: $'+'{{ secrets.OPENFOOT_API_KEY }}',
    'PGPASSWORD: $'+'{{ secrets.M1_PGPASSWORD }}',
    'scripts/m2-openfoot-private-history-run.sh'
  ])assert.ok(w.includes(needle),needle);
  for(const needle of [
    '2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25',
    '--max-redirs 0','--max-filesize 200000',
    'sleep 1.2','m2-openfoot-private-history-validate.mjs',
    'm2-openfoot-seven-season-full-audit.mjs',
    'football_forecast.research.openfoot_history_store',
    'PGSSLROOTCERT','M2_PRIVATE_SEVEN_SEASON_ARCHIVE'
  ])assert.ok(sh.includes(needle),needle);
  assert.doesNotMatch(w,/^  (?:push|schedule|workflow_run):/m);
  assert.doesNotMatch(w+'\n'+sh,
    /2025\/26|2025%2F26|upload-artifact|git push|curl -L|--location|[?&]cursor=|set -x/);
});
