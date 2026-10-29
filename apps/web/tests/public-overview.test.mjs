import assert from 'node:assert/strict';
import test from 'node:test';
import {readPublicOverview,publicSettingsConfigured} from '../lib/public-overview.ts';

const env={NEXT_PUBLIC_SUPABASE_URL:'https://test.example.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'};
const response=(items)=>new Response(JSON.stringify(items),{status:200,
  headers:{'content-type':'application/json','content-range':'0-0/1'}});
function mockedRest({fail=false,fixtures=[]}={}) {
  const requests=[];
  const fetchImpl=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url);
    const method=init.method ?? 'GET';
    requests.push({url,method,headers:init.headers});
    assert.equal(url.hostname,'test.example.invalid');
    assert.match(url.pathname,/^\/rest\/v1\/ff_(matches|forecasts)$/);
    if (fail) return new Response('unavailable',{status:503});
    if (method==='HEAD') return new Response(null,{status:200,
      headers:{'content-range':url.pathname.endsWith('ff_matches')?'0-2/3':'0-0/1'}});
    return response(fixtures);
  };
  return {fetchImpl,requests};
}
test('no environment gives explicit missing configuration without a network request',async()=>{
  const r=await readPublicOverview(()=>{throw Error('must not fetch');},{});
  assert.deepEqual(r,{state:'not_configured',matches:null,forecasts:null,fixtures:[]});
});
test('all data is obtained through public GET/HEAD requests and zero rows are genuine',async()=>{
  const {fetchImpl,requests}=mockedRest();
  const r=await readPublicOverview(fetchImpl,env);
  assert.equal(r.state,'ready');
  assert.equal(r.matches,3);
  assert.equal(r.forecasts,1);
  assert.deepEqual(r.fixtures,[]);
  assert.equal(requests.length,3);
  assert.ok(requests.every(x=>['HEAD','GET'].includes(x.method)));
  assert.ok(requests.every(x=>x.url.searchParams.get('select')));
});
test('RPL fixture names come from linked public teams, without invented predictions',async()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const {fetchImpl,requests}=mockedRest({fixtures:[{id:'match-1',kickoff_at:future,
    status:'scheduled',home:{name:'Север'},away:{name:'Юг'}}]});
  const r=await readPublicOverview(fetchImpl,env);
  assert.equal(r.state,'ready');
  assert.deepEqual(r.fixtures,[{id:'match-1',kickoffAt:future,
    status:'scheduled',home:'Север',away:'Юг'}]);
  const fixtureQuery=requests.find(x=>x.method==='GET');
  assert.equal(fixtureQuery.url.searchParams.get('status'),'eq.scheduled');
  assert.ok(fixtureQuery.url.searchParams.get('kickoff_at').startsWith('gte.'));
});
test('future cancelled, postponed and finished matches cannot appear as upcoming',async()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const past=new Date(Date.now()-86400000).toISOString();
  const fixture=(id,status,kickoff_at)=>({id,status,kickoff_at,
    home:{name:'Север'},away:{name:'Юг'}});
  const {fetchImpl,requests}=mockedRest({fixtures:[
    fixture('cancelled','cancelled',future),
    fixture('postponed','postponed',future),
    fixture('finished','finished',future),
    fixture('old','scheduled',past),
    fixture('next','scheduled',future)
  ]});
  // Even if an inconsistent upstream REST mock ignores query filters,
  // the public view does not present cancelled or stale fixtures as upcoming.
  const report=await readPublicOverview(fetchImpl,env);
  assert.equal(report.state,'ready');
  assert.deepEqual(report.fixtures.map(x=>x.id),['next']);
  const query=requests.find(x=>x.method==='GET').url.searchParams;
  assert.equal(query.get('status'),'eq.scheduled');
  assert.ok(query.get('kickoff_at').startsWith('gte.'));
});
test('an API error or invalid configuration must not produce fictitious zero metrics',async()=>{
  const r=await readPublicOverview(mockedRest({fail:true}).fetchImpl,env);
  assert.equal(r.state,'unavailable');
  assert.equal(r.matches,null);
  assert.equal(r.forecasts,null);
  const invalid=await readPublicOverview(()=>{throw Error('never fetch');},
    {...env,NEXT_PUBLIC_SUPABASE_URL:'http://example.invalid'});
  assert.equal(invalid.state,'unavailable');
});

test('public health readiness follows anonymous endpoint, never owner login',()=>{
  assert.equal(publicSettingsConfigured(env),true);
  assert.equal(publicSettingsConfigured({...env,APP_OWNER_GITHUB_ID:'invalid'}),true);
  assert.equal(publicSettingsConfigured({...env,NEXT_PUBLIC_SUPABASE_URL:'https://x.invalid/?injected'}),false);
  assert.equal(publicSettingsConfigured({...env,NEXT_PUBLIC_SUPABASE_URL:'http://x.invalid'}),false);
  assert.equal(publicSettingsConfigured({...env,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}),false);
  assert.equal(publicSettingsConfigured({}),false);
});
