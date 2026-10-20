import assert from 'node:assert/strict';
import test from 'node:test';
import {operations} from '../scripts/m0-rest-denials.mjs';
import {checkDisposablePostgrest,disposableOrigin}
  from '../scripts/m0-disposable-postgrest.mjs';

function simulate(overrides={}){
  const requests=[];
  const fetchImpl=async (url,init)=>{
    requests.push({url,init});
    const n=requests.length;
    const item=overrides[n]??(n===1?
      {status:200,payload:[]}:n<=4?
      {status:404,payload:{code:'PGRST205'}}:
      {status:401,payload:{code:'42501'}});
    return new Response(JSON.stringify(item.payload),{
      status:item.status,headers:{'content-type':'application/json'}
    });
  };
  return {requests,fetchImpl};
}
test('PostgREST tests exact eight production-contract operations only on localhost',async()=>{
  const {fetchImpl,requests}=simulate();
  const result=await checkDisposablePostgrest({fetchImpl});
  assert.equal(result.mode,'DISPOSABLE_POSTGREST_NOT_PRODUCTION');
  assert.equal(result.denied,7);
  assert.equal(result.operationCount,8);
  assert.equal(result.productionPostgrestVerified,false);
  assert.equal(result.productionRecoveryVerified,false);
  assert.deepEqual(requests.map(x=>x.init.method),
    ['GET','GET','GET','GET','POST','POST','PATCH','DELETE']);
  for(let i=0;i<requests.length;i++){
    assert.equal(requests[i].url,
      disposableOrigin+operations[i].path.slice('/rest/v1'.length));
    assert.equal(requests[i].init.redirect,'error');
    assert.equal(requests[i].init.cache,'no-store');
    assert.equal('apikey' in requests[i].init.headers,false);
    assert.ok(requests[i].init.signal);
  }
  assert.equal(requests[4].init.body,'{}');
  assert.equal(requests[5].init.body,'{}');
  assert.match(requests[6].url,/id=eq\.00000000-0000-0000-0000-000000000000/);
});
test('metadata SELECT may be hidden with PGRST205 but every mutation must be privilege-denied',async()=>{
  for(const bad of [
    {status:200,payload:[]},
    {status:400,payload:{code:'23502'}},
    {status:404,payload:{code:'PGRST205'}},
    {status:500,payload:{code:'XX000'}}
  ]){
    const {fetchImpl}=simulate({5:bad});
    await assert.rejects(checkDisposablePostgrest({fetchImpl}),
      /Impossible empty fixture INSERT: forbidden operation/);
  }
});
test('private metadata silently readable is never accepted',async()=>{
  const {fetchImpl,requests}=simulate({2:{status:200,payload:[]}});
  await assert.rejects(checkDisposablePostgrest({fetchImpl}),
    /Private source metadata SELECT: forbidden operation/);
  assert.equal(requests.length,2);
});
test('public GET missing, malformed or excessive fails closed',async()=>{
  for(const bad of [
    {status:401,payload:{code:'42501'}},
    {status:404,payload:{code:'PGRST205'}},
    {status:200,payload:{}},
    {status:200,payload:[{},{},{}]}
  ]){
    await assert.rejects(checkDisposablePostgrest({
      fetchImpl:simulate({1:bad}).fetchImpl}),
      /Public matches SELECT: anonymous public GET/);
  }
});
test('unexpected transport errors and malformed JSON do not satisfy the proof',async()=>{
  await assert.rejects(checkDisposablePostgrest({fetchImpl:async()=>{throw Error('secret')}}),
    e=>e.message.includes('transport failure')&&!e.message.includes('secret'));
  await assert.rejects(checkDisposablePostgrest({fetchImpl:async()=>
    new Response('not-json',{status:200})}),/unexpected non-JSON/);
  await assert.rejects(checkDisposablePostgrest({timeoutMs:-1}),/Invalid local/);
});
