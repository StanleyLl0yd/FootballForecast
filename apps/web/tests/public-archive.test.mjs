import assert from 'node:assert/strict';
import test from 'node:test';
import {readPublicArchive} from '../lib/public-archive.ts';

const env={NEXT_PUBLIC_SUPABASE_URL:'https://test.example.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'};
const sample={id:'00000000-0000-0000-0000-000000000001',revision:2,
  predicted_at:'2026-10-17T12:00:00Z',as_of_at:'2026-10-17T11:50:00Z',
  model_version:'m0-fixture',prediction_sha256:'a'.repeat(64),
  home_win:.45,draw:.3,away_win:.25,
  match:{kickoff_at:'2026-10-18T12:00:00Z',
    home:{name:'Example home'},away:{name:'Example away'}}};
function api({rows=[],fail=false}={}){
  const calls=[];
  const fetchImpl=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input.url);
    const method=init.method??'GET';
    calls.push({url,method});
    assert.equal(url.hostname,'test.example.invalid');
    assert.equal(url.pathname,'/rest/v1/ff_forecasts');
    if(fail) return new Response('upstream down',{status:503});
    return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
  };
  return {fetchImpl,calls};
}
test('no public credentials: no request and explicit unconfigured state',async()=>{
  assert.deepEqual(await readPublicArchive(()=>{throw Error('must not fetch');},{}),
    {state:'not_configured',forecasts:[]});
});
test('empty public archive remains empty, never synthetic',async()=>{
  const {fetchImpl,calls}=api();
  assert.deepEqual(await readPublicArchive(fetchImpl,env),{state:'ready',forecasts:[]});
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
  assert.equal(calls[0].url.searchParams.get('order'),'predicted_at.desc');
  assert.equal(calls[0].url.searchParams.get('limit'),'20');
  assert.ok(!calls[0].url.searchParams.get('select').includes('dataset_sha256'));
});
test('published revision, publication cutoff, 1X2 and digest retained without edits',async()=>{
  const data=await readPublicArchive(api({rows:[sample]}).fetchImpl,env);
  assert.equal(data.state,'ready');
  assert.deepEqual(data.forecasts,[{
    id:sample.id,revision:2,predictedAt:sample.predicted_at,asOfAt:sample.as_of_at,
    modelVersion:sample.model_version,predictionHash:sample.prediction_sha256,
    kickoffAt:sample.match.kickoff_at,home:'Example home',away:'Example away',
    homeWin:.45,draw:.3,awayWin:.25
  }]);
});
test('invalid, late or out-of-range published probabilities fail closed',async()=>{
  const invalid=[
    {...sample,home_win:1.2},
    {...sample,draw:.1},
    {...sample,predicted_at:'2026-10-19T00:00:00Z'},
    {...sample,as_of_at:'2026-10-18T00:00:00Z'},
    {...sample,prediction_sha256:'invalid'},
    {...sample,match:{...sample.match,home:null}},
  ];
  for(const row of invalid) {
    const result=await readPublicArchive(api({rows:[row]}).fetchImpl,env);
    assert.equal(result.state,'unavailable');
    assert.deepEqual(result.forecasts,[]);
  }
});
test('vendor failure and malformed settings must not look like an empty archive',async()=>{
  assert.equal((await readPublicArchive(api({fail:true}).fetchImpl,env)).state,'unavailable');
  assert.equal((await readPublicArchive(()=>{throw Error('must not fetch');},
    {...env,NEXT_PUBLIC_SUPABASE_URL:'https://test.example.invalid/?bad'})).state,'unavailable');
});
