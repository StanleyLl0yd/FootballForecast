import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSevenSeasonIdentity} from '../scripts/m2-rpl-team-identity-sample.mjs';
import {HISTORICAL_SEASONS} from '../scripts/m2-openfoot-history-audit.mjs';

const AT='2026-11-03T16:00:00Z';
function sample(){
  return HISTORICAL_SEASONS.map((season,i)=>{
    const data=Array.from({length:50},(_,j)=>{
      const h=j%16,a=(j+1)%16;
      const team=x=>({id:'club_'+x,name:'RPL team '+x});
      return {
        id:'synthetic_'+season.slice(0,4)+'_'+j,
        competitionId:'comp_premier_league_rus',season,status:'finished',
        kickoffAt:season.slice(0,4)+'-09-15T15:00:00Z',
        homeTeam:team(h),awayTeam:team(a),score:{home:1,away:0}
      };
    });
    return {data,meta:{count:50,access:{authenticated:true,plan:'starter'},
      sources:[{name:'Synthetic test source',license:'Unverified'}]}};
  });
}
test('continuity returns only aggregate, even with real-looking private labels',()=>{
  const pages=sample();
  const v=auditSevenSeasonIdentity(pages,AT);
  assert.equal(v.seasons.length,7);
  assert.equal(v.requests,7);
  assert.equal(v.sampleRows,350);
  assert.equal(v.providerIDsAcrossSevenSeasons,16);
  assert.equal(v.matchesPreviousPrivateUniqueCount,false);
  assert.ok(v.seasons.every(x=>x.identityNamesComplete));
  assert.ok(v.consecutiveSeasons.every(x=>x.sharedProviderIds===16&&
    x.unchangedDisplayNames===16&&x.changedDisplayNames===0));
  assert.equal(v.independentlyCorroboratedClubMapping,false);
  assert.equal(v.modelTrainingApproved,false);
  assert.equal(v.holdoutRead,false);
  const text=JSON.stringify(v);
  assert.doesNotMatch(text,/RPL team|club_|synthetic_20|Synthetic test source/);
  assert.match(v.identityContinuitySha256,/^[a-f0-9]{64}$/);
});
test('name drift, ambiguous alias and missing name are counted, never approved',()=>{
  const pages=sample();
  for(const r of pages[1].data){
    if(r.homeTeam.id==='club_3')r.homeTeam.name='Changed team display';
    if(r.awayTeam.id==='club_3')r.awayTeam.name='Changed team display';
  }
  for(const r of pages[2].data){
    if(r.homeTeam.id==='club_6')delete r.homeTeam.name;
    if(r.awayTeam.id==='club_6')delete r.awayTeam.name;
  }
  const result=auditSevenSeasonIdentity(pages,AT);
  assert.equal(result.consecutiveSeasons[0].changedDisplayNames,1);
  assert.equal(result.consecutiveSeasons[1].changedDisplayNames,1);
  assert.equal(result.seasons[2].missingNameIDs,1);
  assert.equal(result.sourceInternalNamesFullyConsistent,false);
  assert.equal(result.independentlyCorroboratedClubMapping,false);
});
test('same ID with conflicting names inside one season is not accepted',()=>{
  const pages=sample();
  pages[0].data[0].homeTeam.name='Unexpected team label';
  const r=auditSevenSeasonIdentity(pages,AT);
  assert.equal(r.seasons[0].conflictingNameIDs,1);
  assert.equal(r.seasons[0].identityNamesComplete,false);
});
test('source-shaped sealed season, wrong tier or truncated page refuses',()=>{
  for(const edit of [
    p=>{p[0].data[0].season='2025/26';},
    p=>{p[0].meta.access.plan='developer';},
    p=>{p[0].meta.count=30;},
    p=>{p.pop();}
  ]){
    const p=sample();edit(p);
    assert.throws(()=>auditSevenSeasonIdentity(p,AT),/refused/);
  }
});
test('job has seven free bounded pre-holdout requests and strict owner guard',()=>{
  const yaml=readFileSync(new URL(
    '../.github/workflows/m2-public-sources-observe.yml',import.meta.url),'utf8');
  const start=yaml.indexOf('  bounded-openfoot-team-identity:');
  assert.ok(start>0);
  const job=yaml.slice(start);
  for(const needle of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.openfoot_identity == 'AUDIT_RPL_TEAM_IDENTITY'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-openfoot-team-identity'",
    'm2-rpl-team-identity-sample.mjs',
    '2018/19 2019/20 2020/21 2021/22 2022/23 2023/24 2024/25',
    '--max-redirs 0','--max-filesize 200000','persist-credentials: false'
  ])assert.ok(job.includes(needle),needle);
  assert.doesNotMatch(job,/2025\/26|2025%2F26|upload-artifact|git push|DATABASE_URL|[?&]cursor=|set -x/);
});
