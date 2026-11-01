import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  readOverdueScheduledCount,readOverdueScheduledFixtures,OVERDUE_KICKOFF_GRACE_MS
} from '../lib/current-freshness.ts';

const env={
  NEXT_PUBLIC_SUPABASE_URL:'https://test.example.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'
};
const now=Date.parse('2026-11-01T16:00:00Z');

test('missing settings and unusable clock never send a request',async()=>{
  const noFetch=()=>{throw Error('unexpected network access');};
  assert.deepEqual(await readOverdueScheduledCount(noFetch,{},now),
    {state:'not_configured',count:null});
  assert.deepEqual(await readOverdueScheduledCount(noFetch,env,NaN),
    {state:'unavailable',count:null});
  assert.deepEqual(await readOverdueScheduledCount(noFetch,env,OVERDUE_KICKOFF_GRACE_MS),
    {state:'unavailable',count:null});
});

test('owner diagnostic counts only scheduled fixtures older than two hours',async()=>{
  const calls=[];
  const fetchImpl=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url);
    calls.push({url,init});
    return new Response(null,{status:200,headers:{'content-range':'0-1/2'}});
  };
  const result=await readOverdueScheduledCount(fetchImpl,env,now);
  assert.deepEqual(result,{state:'ready',count:2});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url.pathname,'/rest/v1/ff_matches');
  assert.equal(calls[0].url.searchParams.get('status'),'eq.scheduled');
  assert.equal(calls[0].url.searchParams.get('kickoff_at'),'lt.2026-11-01T14:00:00.000Z');
  assert.equal(calls[0].url.searchParams.get('select'),'id');
  assert.equal(calls[0].init.method,'HEAD');
  assert.equal(calls[0].init.cache,'no-store');
  assert.equal(calls[0].init.body,undefined);
});

test('zero is a verified count; transport failures are unknown, never zero',async()=>{
  const zero=async()=>new Response(null,{status:200,headers:{'content-range':'*/0'}});
  const fail=async()=>new Response('offline',{status:503});
  assert.deepEqual(await readOverdueScheduledCount(zero,env,now),{state:'ready',count:0});
  assert.deepEqual(await readOverdueScheduledCount(fail,env,now),{state:'unavailable',count:null});
  assert.deepEqual(await readOverdueScheduledCount(zero,{
    ...env,NEXT_PUBLIC_SUPABASE_URL:'http://invalid.example'
  },now),{state:'unavailable',count:null});
});

test('public overdue list is bounded anonymous GET without scores or write operations',async()=>{
  const requests=[];
  const fetchImpl=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url);
    requests.push({url,init});
    return new Response(JSON.stringify([{
      id:'overdue',kickoff_at:'2026-11-01T10:00:00Z',
      status:'scheduled',home:{name:'Оренбург'},away:{name:'ЦСКА'}
    }]),{status:200,headers:{'content-type':'application/json'}});
  };
  const report=await readOverdueScheduledFixtures(fetchImpl,env,now);
  assert.deepEqual(report,{state:'ready',fixtures:[{
    id:'overdue',kickoffAt:'2026-11-01T10:00:00Z',home:'Оренбург',away:'ЦСКА'
  }]});
  assert.equal(requests.length,1);
  const {url,init}=requests[0];
  assert.equal(init.method??'GET','GET');
  assert.equal(init.body,undefined);
  assert.equal(init.cache,'no-store');
  assert.equal(url.pathname,'/rest/v1/ff_matches');
  assert.equal(url.searchParams.get('status'),'eq.scheduled');
  assert.equal(url.searchParams.get('kickoff_at'),'lt.2026-11-01T14:00:00.000Z');
  assert.equal(url.searchParams.get('order'),'kickoff_at.desc');
  assert.equal(url.searchParams.get('limit'),'8');
  assert.doesNotMatch(url.searchParams.get('select'),/goals|source_sha|snapshot/);
});

test('public overdue list rejects invalid timestamps, wrong statuses, and uncertain identities',async()=>{
  const row=(id,kickoff_at,status='scheduled')=>({
    id,kickoff_at,status,home:{name:'Север'},away:{name:'Юг'}
  });
  const bad=[
    row('future','2026-11-01T15:00:00Z'),
    row('ongoing','2026-11-01T13:30:00Z'),
    row('date-only','2026-10-31'),
    row('timezone-free','2026-10-31T12:00:00'),
    row('final','2026-11-01T10:00:00Z','finished'),
    {...row('no-team','2026-11-01T10:00:00Z'),home:{name:''}}
  ];
  for(const fixture of bad){
    const fetchImpl=async()=>new Response(JSON.stringify([fixture]),{status:200,
      headers:{'content-type':'application/json'}});
    assert.deepEqual(await readOverdueScheduledFixtures(fetchImpl,env,now),
      {state:'unavailable',fixtures:[]});
  }
});

test('public overdue list distinguishes genuine zero, outage and missing configuration',async()=>{
  const ok=async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  const fail=async()=>new Response('unavailable',{status:503});
  assert.deepEqual(await readOverdueScheduledFixtures(ok,env,now),
    {state:'ready',fixtures:[]});
  assert.deepEqual(await readOverdueScheduledFixtures(fail,env,now),
    {state:'unavailable',fixtures:[]});
  assert.deepEqual(await readOverdueScheduledFixtures(()=>{throw Error('unexpected');},{},now),
    {state:'not_configured',fixtures:[]});
  assert.deepEqual(await readOverdueScheduledFixtures(ok,env,NaN),
    {state:'unavailable',fixtures:[]});
});
