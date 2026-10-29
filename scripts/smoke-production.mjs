// Non-gating production HTTP canary from a network-enabled GitHub runner.
// It never sends credentials, mutates data, or substitutes vendor data.
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';

const origin = 'https://footballforecast.vercel.app';
const attempts = 3;
async function get(path,extraHeaders={}) {
  let previous;
  for (let i=0;i<attempts;i++) {
    try {
      const res=await fetch(origin+path, {redirect:'manual',cache:'no-store',
        signal:AbortSignal.timeout(12000),headers:{'user-agent':'FootballForecast-Canary/2',...extraHeaders}});
      console.log(path, 'HTTP', res.status, 'redirect',res.headers.get('location')||'none');
      return res;
    } catch(err) {
      previous=err;
      if(i+1<attempts)await sleep(1000*(i+1));
    }
  }
  throw new Error(`Production GET ${path} failed: ${String(previous)}`);
}

const health=await get('/api/health');
assert.equal(health.status,200,'public health must be reachable without authentication');
assert.match(health.headers.get('content-type')??'',/application\/json/i);
assert.equal(health.headers.get('x-content-type-options'),'nosniff');
assert.equal(health.headers.get('x-frame-options'),'DENY');
assert.match(health.headers.get('cache-control')??'',/no-store/);
const status=await health.json();
assert.equal(status.service,'footballforecast');
assert.ok(['public_configured','setup_required','configured'].includes(status.status));
console.log('health status:',status.status,'(public endpoint presence only)');

const dash=await get('/dashboard');
assert.equal(dash.status,200,'public dashboard must render without Vercel authentication');
assert.match(dash.headers.get('content-type')??'',/text\/html/i);
const html=await dash.text();
assert.match(html,/Футбольная аналитика/);
assert.match(html,/Публичная база подключена/,'dashboard must actually reach anonymous Supabase REST');
assert.doesNotMatch(html,/Данные временно недоступны/);

const matches=await get('/matches');
assert.equal(matches.status,200,'public matches must render');
const matchesPage=await matches.text();
assert.ok(matchesPage.includes('Матчи и прогнозы'));
if(matchesPage.includes('Последние результаты РПЛ')) {
  assert.ok(matchesPage.includes('Footbolno (CC BY 4.0)'),
    'real M1 match catalog must attribute its CC BY source');
  assert.ok(!matchesPage.includes('Результаты временно недоступны'),
    'new public recent results API must respond without outage');
}

const admin=await get('/admin');
assert.ok([303,307,308].includes(admin.status),'admin must redirect without owner auth');
const location=new URL(admin.headers.get('location')??'',origin);
assert.equal(location.origin,origin,'admin redirects must stay same-origin');
assert.ok(['/login','/setup'].includes(location.pathname),'admin must redirect to setup/login');

const archive=await get('/archive');
assert.equal(archive.status,200,'public archive must render');
const archivePage=await archive.text();
// PR smoke checks currently deployed main, which predates the archive feature.
// Post-merge production smoke will exercise the new read-only archive.
if(archivePage.includes('История публикаций')) {
  assert.doesNotMatch(archivePage,/Архив временно недоступен/,
    'archive database errors must not masquerade as empty records');
} else {
  assert.match(archivePage,/Архив пуст/,
    'older production must still render accurate empty archive');
}
const data=await get('/data');
assert.equal(data.status,200,'data center must remain public');
const dataPage=await data.text();
assert.match(dataPage,/Центр данных/);
if(dataPage.includes('Официальные первоисточники')){
  // The PR HTTP canary targets deployed main; enforce full catalog after merge.
  assert.match(dataPage,/Источников в реестре/);
  assert.match(dataPage,/Точность не измерена/);
  if(dataPage.includes('M1 / РЕЕСТР ИСТОЧНИКОВ')) {
    assert.ok(dataPage.includes('Footbolno (CC BY 4.0) импортирован'),
      'current M1 catalog must acknowledge verified private Footbolno ingestion');
  } else {
    assert.match(dataPage,/Ни один источник пока не одобрен/,
      'historic M0 version must retain honest no-import status');
  }
}else{
  assert.match(dataPage,/Источники ещё не подключены/,
    'older deployed main must still accurately say no feeds are connected');
}

const connectivity=await get('/connectivity');
assert.equal(connectivity.status,200,'browser connectivity self-check must remain public');
const connectivityHtml=await connectivity.text();
assert.match(connectivityHtml,/Проверка соединения/,
  'browser connectivity page must server-render the diagnostic heading');
assert.match(connectivityHtml,/Проверить соединение/,
  'browser connectivity page must offer its user-initiated probe action');

// Verify the actual deployed static offline fallback and file:// CORS boundary.
// Node sends the same Origin:null used by a local-file browser; no secret or login.
const offline=await get('/m0-carrier-check.html');
assert.equal(offline.status,200,'standalone carrier fallback HTML must be public');
assert.ok((offline.headers.get('content-type')??'').includes('text/html'),
  'offline checker must be served as HTML');
const offlineHtml=await offline.text();
assert.match(offlineHtml,/FootballForecast: проверка из сети оператора/);
assert.match(offlineHtml,/credentials:'omit'/);
assert.ok(offlineHtml.includes("fetch(ORIGIN+'/api/health'"),
  'offline checker must request only the fixed health origin');

const cors=await get('/api/health',{Origin:'null'});
assert.equal(cors.status,200,'health must answer from a file-origin probe');
assert.equal(cors.headers.get('access-control-allow-origin'),'*',
  'public health JSON must explicitly allow offline file-origin CORS');
const corsStatus=await cors.json();
assert.equal(corsStatus.service,'footballforecast');
assert.equal(corsStatus.status,'public_configured');
console.log('PASS: offline HTML delivered and local-file Origin:null health CORS validated');

console.log('PASS: live production HTTP health, public Supabase reads, protected admin, archive/data/connectivity');
