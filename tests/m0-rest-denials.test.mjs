import assert from 'node:assert/strict';
import test from 'node:test';
import {checkAnonymousRestBoundary,projectOrigin} from '../scripts/m0-rest-denials.mjs';

const fakeKey='sb_publishable_synthetic_only_test_key';
function simulated({overrides={}}={}) {
  const requests=[];
  const fetchImpl=async (url,init)=>{
    requests.push({url,init});
    const n=requests.length;
    const response=overrides[n]??(n===1?{status:200,body:[]}:{status:401,body:{code:'42501',message:'denied'}});
    return new Response(JSON.stringify(response.body),{status:response.status,headers:{'content-type':'application/json'}});
  };
  return {fetchImpl,requests};
}

test('one public GET and seven provably non-mutating REST denials',async()=>{
  const {fetchImpl,requests}=simulated();
  const result=await checkAnonymousRestBoundary(fakeKey,{fetchImpl});
  assert.equal(result.publicRead,'PASS');
  assert.equal(result.denied,7);
  assert.equal(requests.length,8);
  assert.equal(requests[0].url,projectOrigin+'/rest/v1/ff_matches?select=id&limit=1');
  assert.deepEqual(requests.map(r=>r.init.method),['GET','GET','GET','GET','POST','POST','PATCH','DELETE']);
  for(const {url,init} of requests){
    assert.ok(url.startsWith(projectOrigin+'/rest/v1/ff_'));
    assert.equal(init.headers.apikey,fakeKey);
    assert.equal(init.redirect,'error');
    assert.equal(init.cache,'no-store');
    assert.ok(init.signal);
  }
  assert.equal(requests[4].init.body,'{}');
  assert.equal(requests[5].init.body,'{}');
  assert.match(requests[6].url,/id=eq\.00000000-0000-0000-0000-000000000000/);
  assert.match(requests[7].url,/id=eq\.00000000-0000-0000-0000-000000000000/);
  assert.ok(!JSON.stringify(result).includes(fakeKey));
});

test('invalid credentials refuse before network use',async()=>{
  const {fetchImpl,requests}=simulated();
  for(const key of [undefined,'','service_role_secret','eyJlegacy','sb_publishable_short'])
    await assert.rejects(checkAnonymousRestBoundary(key,{fetchImpl}),/publishable key/);
  assert.equal(requests.length,0);
});

test('network errors are sanitized, never counted as RLS success',async()=>{
  await assert.rejects(checkAnonymousRestBoundary(fakeKey,{fetchImpl:async()=>{throw Error('private route');}}),
    e=>e.message.includes('transport/timeout')&&!e.message.includes('private route'));
});

test('misleading allow, validation errors, and server errors must not count as forbidden',async()=>{
  for(const bad of [
    {status:204,body:{}},{status:400,body:{code:'23502'}},
    {status:403,body:{code:'PGRST301'}},{status:500,body:{code:'XX000'}},
    {status:200,body:[]}
  ]){
    const {fetchImpl}=simulated({overrides:{5:bad}});
    await assert.rejects(checkAnonymousRestBoundary(fakeKey,{fetchImpl}),/Impossible empty fixture INSERT/);
  }
});

test('private source becoming readable must fail closed',async()=>{
  const {fetchImpl,requests}=simulated({overrides:{2:{status:200,body:[]}}});
  await assert.rejects(checkAnonymousRestBoundary(fakeKey,{fetchImpl}),/Private source metadata SELECT/);
  assert.equal(requests.length,2);
});

test('public read must succeed with bounded JSON array',async()=>{
  for(const bad of [
    {status:401,body:{code:'42501'}},{status:200,body:{}},{status:200,body:[{},{}]}
  ]){
    await assert.rejects(checkAnonymousRestBoundary(fakeKey,{
      fetchImpl:simulated({overrides:{1:bad}}).fetchImpl}),/Public matches SELECT/);
  }
});
