// Node 22 HTTP integration smoke for a built Next.js production server.
// No Supabase account, OAuth token, real user or external network access needed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const appDir = resolve('apps/web');
const nextBin = require.resolve('next/dist/bin/next');

async function availablePort() {
  const server = createServer();
  await new Promise((ok, fail) => server.once('error', fail).listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  await new Promise((ok, fail) => server.close(err => err ? fail(err) : ok()));
  return port;
}

async function testServer(name, overrides) {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  // Force a known unconfigured baseline, even on a runner with inherited env.
  const env = {
    ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    APP_OWNER_GITHUB_ID: '', APP_BASE_URL: '', ...overrides,
  };
  const proc = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: appDir, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [proc.stdout, proc.stderr]) {
    stream.on('data', chunk => { output = (output + chunk.toString()).slice(-10000); });
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (proc.exitCode !== null) throw new Error(`Next exited with ${proc.exitCode}: ${output}`);
      try {
        const r = await fetch(`${origin}/api/health`, {signal: AbortSignal.timeout(1500)});
        if (r.status === 200) {ready = true; break;}
      } catch { /* Next is starting. */ }
      await delay(250);
    }
    assert.ok(ready, `Next did not start: ${output}`);

    const get = path => fetch(origin + path, {redirect: 'manual', signal: AbortSignal.timeout(5000)});
    const health = await get('/api/health');
    assert.equal(health.status, 200, `${name}: health status`);
    assert.deepEqual(await health.json(), {service: 'footballforecast', status: 'setup_required'});
    assert.match(health.headers.get('cache-control') ?? '', /no-store/);
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');

    for (const path of ['/dashboard','/matches','/models','/analytics','/data','/archive','/admin']) {
      const r = await get(path);
      assert.ok([303, 307, 308].includes(r.status), `${name}: ${path} status ${r.status}`);
      assert.equal(new URL(r.headers.get('location'), origin).pathname, '/setup',
        `${name}: ${path} must fail closed`);
      assert.match(r.headers.get('cache-control') ?? '', /no-store|private/,
        `${name}: ${path} must not be public-cacheable`);
    }
    const callback = await get('/auth/callback?code=ci-synthetic');
    assert.equal(callback.status, 503);
    assert.deepEqual(await callback.json(), {error: 'setup_required'});
    const login = await get('/login');
    assert.equal(login.status, 200);
    assert.match(await login.text(), /Сначала подключить Supabase/);
    const setup = await get('/setup');
    assert.equal(setup.status, 200);
    assert.match(await setup.text(), /Требуется настройка платформы/);
    console.log(`PASS ${name}: 7 protected routes fail closed, health and auth/setup endpoints safe`);
  } finally {
    if (proc.exitCode === null) {
      try {
        if (process.platform === 'win32') proc.kill('SIGTERM');
        else process.kill(-proc.pid, 'SIGTERM');
      } catch { proc.kill('SIGTERM'); }
    }
  }
}

await testServer('no Supabase configuration', {});
await testServer('invalid owner ID with placeholder Supabase fields', {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'ci-only-placeholder',
  APP_OWNER_GITHUB_ID: 'not-a-numeric-github-id',
  APP_BASE_URL: 'https://example.invalid',
});
console.log('M0 HTTP production-server auth smoke complete. Real OAuth and browser E2E remain pending.');
