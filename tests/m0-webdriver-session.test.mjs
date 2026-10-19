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
