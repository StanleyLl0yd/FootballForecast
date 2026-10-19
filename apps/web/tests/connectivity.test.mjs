import assert from 'node:assert/strict';
import test from 'node:test';
import {runConnectivityChecks,formatConnectivityReport,validPublishableEndpoint} from '../lib/connectivity.ts';

const origin='https://forecast.example';
const project='https://upulkesaiwnwfagjgteh.supabase.co';
const key='sb_publishable_synthetic_test_only';
test('three read-only user-initiated probes do not send credentials to the public site',async()=>{
  const requests=[];
  const mock=async(input,init)=>{
    const url=new URL(input,origin);
    requests.push({url,init});
    if(url.pathname==='/api/health')
      return new Response(JSON.stringify({service:'footballforecast',status:'public_configured'}),{status:200});
    if(url.pathname==='/dashboard')
      return new Response('Футбольная аналитика Публичная база подключена',{status:200});
    if(url.pathname==='/rest/v1/ff_matches')
      return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
    throw new Error('Unexpected URL');
  };
  const result=await runConnectivityChecks(project,key,mock);
  assert.deepEqual(result.map(x=>x.state),['passed','passed','passed']);
  assert.equal(requests.length,3);
  assert.ok(requests.every(x=>x.init.method==='GET'&&x.init.cache==='no-store'));
  assert.equal(requests[0].init.headers?.apikey,undefined);
  assert.equal(requests[1].init.headers?.apikey,undefined);
  assert.equal(requests[2].init.headers.apikey,key);
  assert.equal(requests[2].url.searchParams.get('limit'),'1');
  assert.equal(requests[2].url.origin,project);
  const report=formatConnectivityReport(result,'2026-10-19T00:00:00Z');
  assert.ok(!report.includes(key));
  assert.ok(!report.includes(project));
  assert.ok(report.includes('PASS HTTP 200'));
});
test('unavailable database and HTTP failure report accurately without guessing network cause',async()=>{
  const mock=async input=>{
    if(String(input).includes('/api/health'))return new Response('{}',{status:200});
    if(String(input).includes('/dashboard'))throw new Error('private DNS diagnostic must not leak');
    return new Response('blocked',{status:403});
  };
  const result=await runConnectivityChecks(project,key,mock);
  assert.deepEqual(result.map(x=>x.state),['failed','failed','failed']);
  assert.equal(result[1].httpStatus,null);
  assert.equal(result[2].httpStatus,403);
  assert.ok(!formatConnectivityReport(result,'now').includes('private DNS diagnostic'));
});
test('missing or malformed publishable settings never initiate a third-party request',async()=>{
  const calls=[];
  const mock=async input=>{calls.push(input);return new Response('{}',{status:200});};
  const result=await runConnectivityChecks('http://database.example','private_secret',mock);
  assert.equal(calls.length,2);
  assert.equal(result[2].state,'not_configured');
  assert.equal(validPublishableEndpoint(project+'/path',key),false);
  assert.equal(validPublishableEndpoint(project+'?token=1',key),false);
  assert.equal(validPublishableEndpoint(project,key),true);
  assert.equal(validPublishableEndpoint('https://upulkesaiwnwfagjgteh.supabase.co.attacker.example',key),false);
});

test('a misleading HTTP 200 non-JSON response does not count as Supabase success',async()=>{
  const mock=async input=>{
    if(String(input).includes('/api/health'))
      return new Response(JSON.stringify({service:'footballforecast',status:'public_configured'}),{status:200});
    if(String(input).includes('/dashboard'))return new Response('Футбольная аналитика Публичная база подключена',{status:200});
    return new Response('<html>gateway response</html>',{status:200,headers:{'content-type':'text/html'}});
  };
  const result=await runConnectivityChecks(project,key,mock);
  assert.deepEqual(result.map(x=>x.state),['passed','passed','failed']);
});
