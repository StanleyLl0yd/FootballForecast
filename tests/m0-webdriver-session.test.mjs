import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const script=readFileSync(
  new URL('../scripts/smoke-cross-browser.mjs',import.meta.url),'utf8');

test('non-idempotent Firefox session is created once after driver readiness',()=>{
  const probe="request('/status',undefined,'GET')";
  const create="request('/session',{";
  assert.ok(script.includes(probe));
  assert.equal(script.split(create).length-1,1);
  assert.ok(script.indexOf(probe)<script.indexOf(create));
  assert.match(script,/status\?\.ready===true/);
  assert.match(script,/assert\.ok\(ready,'geckodriver must report ready before session creation'\)/);
});
test('Firefox session teardown and Edge protection remain enforced',()=>{
  assert.match(script,/request\(\`\/session\/\$\{id\}\`,undefined,'DELETE'\)/);
  assert.match(script,/expectPage\(source,path\)/);
  assert.match(script,/PASS Mozilla Firefox headless/);
  assert.match(script,/expectPage\(stdout,path\)/);
});

test('Firefox cold-start has one bounded longer session timeout without weakening other requests',()=>{
  assert.match(script,/async function request\(path,body,method,\{timeoutMs=35000\}=\{\}\)/);
  assert.match(script,/signal:AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(script,/\},undefined,\{timeoutMs:90000\}\);/);
  assert.equal(script.split("request('/session',{").length-1,1,
    'POST /session remains exactly once and is never retried');
  assert.doesNotMatch(script,/for\s*\([^)]*\)\s*\{[^{}]*request\('\/session'/);
});
