import assert from 'node:assert/strict';
import test from 'node:test';
import {readRecentResults} from '../lib/public-results.ts';

const env={NEXT_PUBLIC_SUPABASE_URL:'https://test.example.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'};
const now=Date.parse('2026-10-29T12:00:00Z');
const row=(id,kickoff_at,status='finished',home_goals=2,away_goals=1)=>({
  id,kickoff_at,status,home_goals,away_goals,
  home:{name:'Север'},away:{name:'Юг'}
});
function fixtureFetch(rows,{http=200}={}){
  const requests=[];
  const fetchImpl=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url);
    requests.push({url,method:init.method??'GET'});
    assert.equal(url.hostname,'test.example.invalid');
    if(http!==200)return new Response('provider-unavailable',{status:http});
    return new Response(JSON.stringify(rows),{status:200,
      headers:{'content-type':'application/json'}});
  };
  return {fetchImpl,requests};
}

test('missing configuration never accesses a network',async()=>{
  assert.deepEqual(await readRecentResults(()=>{throw Error('unexpected');},{}),
    {state:'not_configured',results:[]});
});

test('recent results use one bounded anonymous GET with score fields',async()=>{
  const api=fixtureFetch([row('real-match','2026-10-28T18:00:00Z')]);
  const result=await readRecentResults(api.fetchImpl,env,now);
  assert.deepEqual(result,{state:'ready',results:[{
    id:'real-match',kickoffAt:'2026-10-28T18:00:00Z',
    home:'Север',away:'Юг',homeGoals:2,awayGoals:1
  }]});
  assert.equal(api.requests.length,1);
  const {url,method}=api.requests[0];
  assert.equal(method,'GET');
  assert.equal(url.pathname,'/rest/v1/ff_matches');
  assert.equal(url.searchParams.get('status'),'eq.finished');
  assert.equal(url.searchParams.get('kickoff_at'),'lte.2026-10-29T12:00:00.000Z');
  assert.equal(url.searchParams.get('limit'),'12');
  assert.equal(url.searchParams.get('order'),'kickoff_at.desc');
  for(const field of ['home_goals','away_goals','ff_teams'])
    assert.ok(url.searchParams.get('select').includes(field));
});

test('bad scores, future fixtures, nonfinal status and unknown team names are not rendered',async()=>{
  const a=fixtureFetch([
    row('good','2026-10-28T18:00:00Z','finished',0,0),
    row('future','2026-11-01T18:00:00Z'),
    row('planned','2026-10-28T18:00:00Z','scheduled'),
    row('invalid','2026-10-28T18:00:00Z','finished',null,1),
    row('negative','2026-10-28T18:00:00Z','finished',-1,2),
    {...row('unnamed','2026-10-28T18:00:00Z'),home:{name:''}}
  ]);
  const r=await readRecentResults(a.fetchImpl,env,now);
  assert.equal(r.state,'ready');
  assert.deepEqual(r.results.map(x=>x.id),['good']);
});

test('outages and invalid endpoint fail closed without inventing zero results',async()=>{
  assert.deepEqual(await readRecentResults(fixtureFetch([],{http:503}).fetchImpl,env,now),
    {state:'unavailable',results:[]});
  assert.deepEqual(await readRecentResults(()=>{throw Error('unreachable');},
    {...env,NEXT_PUBLIC_SUPABASE_URL:'http://untrusted.invalid'},now),
    {state:'unavailable',results:[]});
});
