import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const page=readFileSync(new URL('../public/m0-carrier-check.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'self-contained offline JavaScript must exist');

function prepare(fetchImpl){
  const callbacks=new Map();
  const elements={};
  for(const id of ['run','copy','report','result','copy-help','provider','city','network','no-vpn']){
    elements[id]={
      value:id==='network'?'не указано':'',
      checked:false,
      disabled:id==='copy',
      textContent:'',
      focus(){},
      select(){},
      addEventListener(type,fn){callbacks.set(id+':'+type,fn)}
    };
  }
  let count=0;
  const calls=[];
  const context={
    document:{getElementById:id=>{
      assert.ok(elements[id],`Unexpected element ${id}`);
      return elements[id];
    }},
    fetch:async(...args)=>{count++;calls.push(args);return fetchImpl(...args)},
    Response,Date,
    AbortSignal:{timeout(ms){assert.equal(ms,12000);return {}}},
    navigator:{clipboard:{async writeText(){}}}
  };
  vm.runInNewContext(script,context,{timeout:1000});
  return {elements,callbacks,calls,get count(){return count}};
}

test('offline page is static, with no remote executable dependencies or auto-request',()=>{
  assert.match(page,/<html lang="ru">/);
  assert.match(page,/connect-src https:\/\/footballforecast\.vercel\.app/);
  assert.doesNotMatch(page,/<script[^>]+src=|<link[^>]+stylesheet|localStorage|sessionStorage|geolocation|sendBeacon|fetch\(['"]https:\/\/[^f]/);
  const h=prepare(()=>{throw new Error('must not fetch during load')});
  assert.equal(h.count,0);
  assert.ok(h.callbacks.has('run:click'));
});

test('offline health PASS needs exact JSON and safe GET, not just a 200 page',async()=>{
  const h=prepare(async()=>new Response(JSON.stringify({
    service:'footballforecast',status:'public_configured'
  }),{status:200,headers:{'content-type':'application/json'}}));
  h.elements.provider.value='  Test provider  ';
  h.elements.network.value='мобильный интернет';
  h.elements['no-vpn'].checked=true;
  await h.callbacks.get('run:click')();
  assert.equal(h.count,1);
  assert.equal(h.calls[0][0],'https://footballforecast.vercel.app/api/health');
  assert.equal(h.calls[0][1].method,'GET');
  assert.equal(h.calls[0][1].mode,'cors');
  assert.equal(h.calls[0][1].credentials,'omit');
  assert.equal(h.calls[0][1].redirect,'error');
  assert.equal(h.calls[0][1].cache,'no-store');
  assert.equal(h.calls[0][1].referrerPolicy,'no-referrer');
  assert.equal(h.calls[0][1].headers,undefined);
  assert.match(h.elements.report.value,/Результат: PASS \/ HTTP 200/);
  assert.match(h.elements.report.value,/Без VPN\/прокси: подтверждено тестировщиком/);
  assert.match(h.elements.report.value,/Оператор: Test provider/);
  assert.equal(h.elements.copy.disabled,false);
});

test('HTTP 200 with wrong body, configured=false or unexpected status does not count',async()=>{
  for(const response of [
    new Response('Login page',{status:200,headers:{'content-type':'text/html'}}),
    new Response(JSON.stringify({service:'footballforecast',status:'setup_required'}),{status:200,headers:{'content-type':'application/json'}}),
    new Response('Forbidden',{status:403})
  ]){
    const h=prepare(async()=>response);
    await h.callbacks.get('run:click')();
    assert.match(h.elements.report.value,/Результат: FAIL \/ HTTP/);
  }
});

test('transport errors are redacted and optional operator cannot forge report lines',async()=>{
  const h=prepare(async()=>{throw new Error('local private proxy 10.99.8.7 /supersecret')});
  h.elements.provider.value='Operator\nРезультат: PASS';
  await h.callbacks.get('run:click')();
  const report=h.elements.report.value;
  assert.match(report,/Результат: FAIL \/ нет HTTP-ответа/);
  assert.doesNotMatch(report,/10\.99\.8\.7|supersecret/);
  assert.match(report,/Оператор: Operator Результат: PASS/);
  assert.equal(report.split('\n').filter(x=>x.startsWith('Результат:')).length,1);
});

test('public health endpoint enables CORS for a locally opened, keyless file only',()=>{
  const health=readFileSync(new URL('../app/api/health/route.ts',import.meta.url),'utf8');
  assert.match(health,/'Access-Control-Allow-Origin':'\*'/);
  assert.match(health,/'Cache-Control':'no-store'/);
  assert.doesNotMatch(health,/service_role|FF_SUPABASE_PUBLISHABLE_KEY/);
});
