import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runConnectivityChecks,formatConnectivityReport} from '../lib/connectivity.ts';

test('all three probes are same-origin GETs and do not expose any Supabase key',async()=>{
  const calls=[];
  const fetchMock=async(url,options)=>{
    calls.push({url,options});
    if(url==='/api/health')return new Response(
      JSON.stringify({service:'footballforecast',status:'public_configured'}),
      {status:200,headers:{'content-type':'application/json'}});
    if(url==='/dashboard')return new Response('Футбольная аналитика Публичная база подключена',{status:200});
    if(url==='/archive')return new Response('История публикаций Архив пуст',{status:200});
    throw new Error('Unexpected request');
  };
  const results=await runConnectivityChecks(fetchMock);
  assert.deepEqual(results.map(x=>x.state),['passed','passed','passed']);
  assert.deepEqual(calls.map(x=>x.url),['/api/health','/dashboard','/archive']);
  assert.ok(calls.every(x=>x.options.method==='GET'&&
    x.options.cache==='no-store'&&x.options.redirect==='error'&&
    !x.options.headers));
  const report=formatConnectivityReport(results,'2026-10-19T00:00:00Z');
  assert.match(report,/PASS HTTP 200/);
  assert.ok(!report.includes('sb_publishable_'));
  assert.ok(!report.includes('supabase.co'));
});

test('bad API body, server database outage and rejection are distinct failed probes',async()=>{
  const fetchMock=async url=>{
    if(url==='/api/health')return new Response('not JSON',{status:200,headers:{'content-type':'text/plain'}});
    if(url==='/dashboard')return new Response('Футбольная аналитика Данные временно недоступны',{status:200});
    throw new Error('network private detail');
  };
  const result=await runConnectivityChecks(fetchMock);
  assert.deepEqual(result.map(x=>x.state),['failed','failed','failed']);
  assert.equal(result[0].httpStatus,200);
  assert.equal(result[2].httpStatus,null);
  assert.doesNotMatch(formatConnectivityReport(result,'now'),/network private detail/);
});

test('archive reports HTTP success only with real public REST status',async()=>{
  const fetchMock=async url=>{
    if(url==='/api/health')return new Response('{"service":"footballforecast","status":"public_configured"}',
      {status:200,headers:{'content-type':'application/json'}});
    if(url==='/dashboard')return new Response('Футбольная аналитика Публичная база подключена',{status:200});
    return new Response('История публикаций Архив временно недоступен',{status:200});
  };
  const result=await runConnectivityChecks(fetchMock);
  assert.deepEqual(result.map(x=>x.state),['passed','passed','failed']);
});

test('false HTTP 200 for an archive login page does not count as accessible',async()=>{
  const fetchMock=async()=>new Response('<html>Login required</html>',{status:200});
  const result=await runConnectivityChecks(fetchMock);
  assert.deepEqual(result.map(x=>x.state),['failed','failed','failed']);
});

test('connectivity button has native static fallback when hydration/scripts fail',()=>{
  const page=readFileSync(new URL('../app/(console)/connectivity/page.tsx',import.meta.url),'utf8');
  assert.match(page,/<form method="get" action="\/m0-carrier-check\.html" onSubmit=\{submit\}>/);
  assert.match(page,/<button type="submit" className="primary-action"/);
  assert.match(page,/data-connectivity-ready=\{ready\?'true':'false'\}/);
  assert.match(page,/event\.preventDefault\(\)/);
  assert.match(page,/void run\(\)/);
  assert.match(page,/role="status" aria-live="polite"/);
  assert.match(page,/catch\{[\s\S]*?setError\(true\)/);
  assert.match(page,/setBusy\(false\)/);
  assert.match(page,/автономную проверку по ссылке ниже/);
  assert.doesNotMatch(page,/type="button" className="primary-action" onClick=\{run\}/);
});
