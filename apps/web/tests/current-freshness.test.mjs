import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  readOverdueScheduledCount,OVERDUE_KICKOFF_GRACE_MS
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
