import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOpenFootballCalendarInput,CALENDAR_PROTOCOL} from '../scripts/m2-openfootball-training.mjs';

const names=Array.from({length:16},(_,i)=>'Synthetic RPL '+i);
const games=[];
for(const home of names)for(const away of names)if(home!==away)games.push({
  homeName:home,awayName:away,round:1,calendarDateUtc:'2024-07-20',
  kickoffAtUtc:null,historicalPrematchVerified:false,resultType:'played',
  homeGoals:1,awayGoals:0
});
const verified=()=>({aggregate:{
  kind:'M2_OPENFOOTBALL_PINNED_REFERENCE_DIAGNOSTIC',
  gitBlobSha1:'6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc',
  sourceRole:'independent_historical_reference_only',
  sourceBytesSha256:'a'.repeat(64)
},fixtures:games});

test('calendar-only train bridge isolates club names, exact frozen source and never invents timestamps',()=>{
  const a=buildOpenFootballCalendarInput(verified());
  const b=buildOpenFootballCalendarInput({...verified(),fixtures:[...games].reverse()});
  assert.deepEqual(a,b);
  assert.equal(a.protocol,CALENDAR_PROTOCOL);
  assert.equal(a.sourceGitBlobSha1,verified().aggregate.gitBlobSha1);
  assert.equal(a.fixtures.length,240);
  assert.equal(new Set(a.fixtures.map(x=>x.matchId)).size,240);
  assert.equal(new Set(a.fixtures.flatMap(x=>[x.homeTeamId,x.awayTeamId])).size,16);
  assert.equal(a.historicalPrematchVerified,false);
  assert.equal(JSON.stringify(a).includes('Synthetic RPL'),false);
  assert.equal(JSON.stringify(a).includes('kickoffAtUtc'),false);
  assert.equal(JSON.stringify(a).includes('Footbolno'),false);
});
test('unexpected source/fixture/timestamp/team identity rejected before fit',()=>{
  const mutations=[
    v=>{v.aggregate.gitBlobSha1='f'.repeat(40)},
    v=>{v.aggregate.sourceRole='train_baseline'},
    v=>{v.aggregate.sourceBytesSha256='invalid'},
    v=>{v.fixtures.pop()},
    v=>{v.fixtures[0].kickoffAtUtc='2024-07-20T00:00:00Z'},
    v=>{v.fixtures[0].resultType='awarded'},
    v=>{v.fixtures[0].homeName=v.fixtures[0].awayName},
    v=>{v.fixtures[0].homeName=''},
  ];
  for(const mutate of mutations){
    const v=structuredClone(verified());mutate(v);
    assert.throws(()=>buildOpenFootballCalendarInput(v),/train-only refused/);
  }
});
