import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readM2TrainOnlyRun,readM2PublicSourcesRun,readM2OpenFootballTrainRun} from '../lib/m2-run-status.ts';

const run=()=>({
  id:41400000001,event:'workflow_dispatch',actor:{login:'StanleyLl0yd'},head_branch:'main',
  head_sha:'a'.repeat(40),status:'completed',conclusion:'success',
  html_url:'https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41400000001',
  inputs:{secret:'must-never-be-rendered'}
});
const response=value=>new Response(JSON.stringify(value),{
  status:200,headers:{'content-type':'application/json'}
});

test('public source status sends only a bounded unauthenticated read and whitelists run metadata',async()=>{
  let calls=0;
  const result=await readM2TrainOnlyRun(async(input,init)=>{
    calls++;
    const u=new URL(input);
    assert.equal(u.origin,'https://api.github.com');
    assert.equal(u.pathname,'/repos/StanleyLl0yd/FootballForecast/actions/workflows/m2-manual-research-lock.yml/runs');
    assert.equal(u.searchParams.get('branch'),'main');
    assert.equal(u.searchParams.get('per_page'),'10');
    assert.equal(init.method,'GET');
    assert.equal(init.body,undefined);
    assert.equal(init.next.revalidate,300);
    assert.equal(init.headers.Authorization,undefined);
    assert.ok(init.signal instanceof AbortSignal);
    return response({total_count:1,workflow_runs:[run()]});
  });
  assert.equal(calls,1);
  assert.deepEqual(result,{
    state:'run',id:41400000001,url:run().html_url,
    status:'completed',conclusion:'success',sha:'a'.repeat(40)
  });
  assert.equal(JSON.stringify(result).includes('secret'),false);
});

test('owner issue-comment run is shown while unrelated and skipped comment runs are ignored',async()=>{
  const unrelated={...run(),id:41400000003,event:'issue_comment',actor:{login:'other-user'}};
  const skipped={...run(),id:41400000002,event:'issue_comment',conclusion:'skipped'};
  const executed={...run(),event:'issue_comment'};
  const result=await readM2TrainOnlyRun(async()=>response({
    total_count:3,workflow_runs:[unrelated,skipped,executed]
  }));
  assert.deepEqual(result,{
    state:'run',id:41400000001,url:run().html_url,
    status:'completed',conclusion:'success',sha:'a'.repeat(40)
  });
  assert.deepEqual(await readM2TrainOnlyRun(async()=>response({
    total_count:1,workflow_runs:[skipped]
  })),{state:'unavailable'});
});

test('a confirmed empty run list is distinct from unavailable GitHub API',async()=>{
  assert.deepEqual(await readM2TrainOnlyRun(async()=>response({
    total_count:0,workflow_runs:[]
  })),{state:'no_runs'});
  assert.deepEqual(await readM2TrainOnlyRun(async()=>new Response('unavailable',{status:429})),
    {state:'unavailable'});
  assert.deepEqual(await readM2TrainOnlyRun(async()=>{throw Error('offline');}),
    {state:'unavailable'});
});

test('reject spoofed workflow, wrong ref, URL, SHA, status or inconsistent outcome',async()=>{
  const bad=[
    {event:'push'},{actor:{login:'other-user'}},{head_branch:'release'},{head_sha:'oops'},
    {html_url:'https://evil.example.invalid/a'},{id:41400000002},
    {status:'weird'},{status:'in_progress',conclusion:'success'},
    {status:'completed',conclusion:null},{conclusion:'green'}
  ];
  for(const patch of bad){
    const result=await readM2TrainOnlyRun(async()=>response({
      total_count:1,workflow_runs:[{...run(),...patch}]
    }));
    assert.deepEqual(result,{state:'unavailable'});
  }
});

test('reject unknown JSON, huge responses and missing run identity',async()=>{
  const bad=[null,[],{}, {total_count:-1,workflow_runs:[]},
    {total_count:1,workflow_runs:[]},{total_count:0,workflow_runs:[run()]},
    {total_count:1,workflow_runs:[run(),run()]},
    {total_count:11,workflow_runs:Array.from({length:11},run)}];
  for(const payload of bad)
    assert.deepEqual(await readM2TrainOnlyRun(async()=>response(payload)),
      {state:'unavailable'});
  const huge='x'.repeat(129*1024);
  assert.deepEqual(await readM2TrainOnlyRun(async()=>new Response(huge,{status:200})),
    {state:'unavailable'});
});

test('public-source workflow lookup is bounded, read-only and treats a success as metadata only',async()=>{
  let calls=0;
  const status=await readM2PublicSourcesRun(async(input,init)=>{
    calls++;
    const url=new URL(input);
    assert.equal(url.origin,'https://api.github.com');
    assert.equal(url.pathname,'/repos/StanleyLl0yd/FootballForecast/actions/workflows/m2-public-sources-observe.yml/runs');
    assert.equal(url.searchParams.get('branch'),'main');
    assert.equal(url.searchParams.get('per_page'),'10');
    assert.equal(init.method,'GET');
    assert.equal(init.body,undefined);
    assert.equal(init.headers.Authorization,undefined);
    assert.equal(init.next.revalidate,300);
    return response({total_count:1,workflow_runs:[run()]});
  });
  assert.equal(calls,1);
  assert.deepEqual(status,{state:'run',id:41400000001,url:run().html_url,
    status:'completed',conclusion:'success',sha:'a'.repeat(40)});
  assert.equal(Object.hasOwn(status,'sourceVerified'),false);
  assert.deepEqual(await readM2PublicSourcesRun(async()=>new Response('rate limited',{status:429})),
    {state:'unavailable'});
  assert.deepEqual(await readM2PublicSourcesRun(async()=>response({
    total_count:1,workflow_runs:[{...run(),actor:{login:'other-user'}}]
  })),{state:'unavailable'});
});

test('owner OpenFootball-only train metadata is read via a separate static workflow allowlist',async()=>{
  const result=await readM2OpenFootballTrainRun(async(input,init)=>{
    const url=new URL(input);
    assert.equal(url.pathname,'/repos/StanleyLl0yd/FootballForecast/actions/workflows/m2-openfootball-train-only.yml/runs');
    assert.equal(url.searchParams.get('branch'),'main');
    assert.equal(init.method,'GET');
    assert.equal(init.body,undefined);
    assert.equal(init.headers.Authorization,undefined);
    return response({total_count:1,workflow_runs:[run()]});
  });
  assert.deepEqual(result,{state:'run',id:41400000001,url:run().html_url,
    status:'completed',conclusion:'success',sha:'a'.repeat(40)});
  assert.equal(Object.hasOwn(result,'modelApproved'),false);
  assert.deepEqual(await readM2OpenFootballTrainRun(async()=>{throw Error('offline');}),
    {state:'unavailable'});
});
