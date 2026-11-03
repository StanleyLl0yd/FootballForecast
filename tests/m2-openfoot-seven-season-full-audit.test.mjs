import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverSeasonTeams,auditSeasonTeamPages,auditSevenFullSeasons} from
  '../scripts/m2-openfoot-seven-season-full-audit.mjs';
import {HISTORICAL_SEASONS} from '../scripts/m2-openfoot-history-audit.mjs';
const AT='2026-11-03T14:00:00Z';
function seasonData(season){
  const rotated=Array.from({length:15},(_,i)=>i+1),pairs=[];
  for(let r=0;r<15;r++){
    const slots=[0,...rotated];
    for(let i=0;i<8;i++)pairs.push([slots[i],slots[15-i]]);
    rotated.unshift(rotated.pop());
  }
  const fixtures=[...pairs,...pairs.map(([a,b])=>[b,a])].map(([a,b],i)=>({
    id:'private_match_'+i,competitionId:'comp_premier_league_rus',
    season,status:'finished',kickoffAt:season.slice(0,4)+'-09-15T16:00:00Z',
    homeTeam:{id:'club_'+a},awayTeam:{id:'club_'+b},
    homeGoals:i%4,awayGoals:i%3
  }));
  const wrap=rows=>({data:rows,meta:{count:rows.length,
    access:{authenticated:true,plan:'starter'},
    sources:[{name:'private source metadata',license:'Unknown'}]}});
  const seed=wrap(fixtures.slice(0,50)),ids=discoverSeasonTeams(seed,season);
  const pages=ids.map(id=>wrap(fixtures.filter(r=>
    r.homeTeam.id===id||r.awayTeam.id===id)));
  return {seed,ids,pages};
}
test('all seven synthetic double-round-robins validate without model authorization',()=>{
  const reports=HISTORICAL_SEASONS.map(season=>{
    const x=seasonData(season);
    const report=auditSeasonTeamPages(x.ids,x.pages,season);
    assert.equal(report.coverageState,'STRUCTURALLY_COMPLETE_UNAPPROVED');
    assert.equal(report.crossConfirmed,240);
    return report;
  });
  const result=auditSevenFullSeasons(reports,AT);
  assert.equal(result.seasonsStructurallyComplete,7);
  assert.equal(result.crossConfirmedMatches,1680);
  assert.equal(result.requestsTotal,119);
  assert.equal(result.newModelTrainingApproved,false);
  assert.equal(result.holdoutRead,false);
  assert.doesNotMatch(JSON.stringify(result),/private_match|club_1|private source metadata/);
});
test('partial rows, missing metadata and paid cursor cannot claim completeness',()=>{
  let x=seasonData('2024/25');
  x.pages[0].data.pop();x.pages[0].meta.count--;
  assert.equal(auditSeasonTeamPages(x.ids,x.pages,'2024/25').coverageState,'PARTIAL_UNAPPROVED');
  x=seasonData('2024/25');x.pages[0].meta.sources=[];
  assert.equal(auditSeasonTeamPages(x.ids,x.pages,'2024/25').coverageState,'PARTIAL_UNAPPROVED');
  x=seasonData('2024/25');x.pages[0].meta.pagination={next_cursor:'paid'};
  assert.equal(auditSeasonTeamPages(x.ids,x.pages,'2024/25').coverageState,
    'INCONCLUSIVE_RESTRICTED_PAGINATION');
});
test('tampered scores, season, identity and access tier fail closed',()=>{
  const bad=fn=>{const x=seasonData('2023/24');fn(x);
    assert.throws(()=>auditSeasonTeamPages(x.ids,x.pages,'2023/24'),/refused/);};
  bad(x=>{x.pages[0].data[0].season='2025/26';});
  bad(x=>{x.pages[0].meta.access.plan='developer';});
  bad(x=>{x.pages[0].data[1].id=x.pages[0].data[0].id;});
  bad(x=>{x.pages[0].data[0].homeTeam.id='foreign';});
  bad(x=>{x.pages[0].data[0]={...x.pages[0].data[0],homeGoals:99};});
  bad(x=>{x.pages[0].data[0].kickoffAt='2026-11-03T00:00:00Z';});
  const incomplete=seasonData('2023/24');
  incomplete.pages[0].data[0].homeGoals=null;
  assert.equal(auditSeasonTeamPages(incomplete.ids,incomplete.pages,'2023/24').coverageState,
    'PARTIAL_UNAPPROVED');
  assert.throws(()=>discoverSeasonTeams(seasonData('2023/24').seed,'2025/26'),/refused/);
});
test('full archive source job is manual, owner-only, bounded and excludes sealed year',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=yaml.indexOf('  bounded-openfoot-full-history:');
  assert.ok(start>0);
  const job=yaml.slice(start);
  for(const s of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.openfoot_full_history == 'AUDIT_RPL_FULL_HISTORY'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-full-history'",
    'OPENFOOT_API_KEY: $'+'{{ secrets.OPENFOOT_API_KEY }}',
    '2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25',
    'm2-openfoot-seven-season-full-audit.mjs',
    '--max-redirs 0','--max-filesize 200000','persist-credentials: false'
  ])assert.ok(job.includes(s),s);
  assert.ok((job.match(/sleep 1\.2/g)||[]).length===2,'two bounded request pacing points');
  assert.doesNotMatch(job,/2025\/26|2025%2F26|upload-artifact|git push|set -x|DATABASE_URL|[?&]cursor=/);
});

test('2019/20 pandemic resumption through 22 July is valid, later or other-season overflow fails',()=>{
  const season='2019/20',make=()=>seasonData(season);
  const mutate=(set,date)=>{
    for(const view of set.pages)for(const row of view.data){
      if(row.id==='private_match_0')row.kickoffAt=date;
    }
  };
  const allowed=make();mutate(allowed,'2020-07-22T15:00:00Z');
  assert.equal(auditSeasonTeamPages(allowed.ids,allowed.pages,season).coverageState,
    'STRUCTURALLY_COMPLETE_UNAPPROVED');
  const tooLate=make();mutate(tooLate,'2020-08-08T15:00:00Z');
  assert.throws(()=>auditSeasonTeamPages(tooLate.ids,tooLate.pages,season),/refused/);
  const normal=seasonData('2018/19');
  mutate(normal,'2020-07-22T15:00:00Z');
  assert.throws(()=>auditSeasonTeamPages(normal.ids,normal.pages,'2018/19'),/refused/);
});
