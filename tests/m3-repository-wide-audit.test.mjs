import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectTrackedFiles} from '../scripts/m3-repository-wide-audit.mjs';

const base=()=>[
  {path:'apps/web/components/a.tsx',body:Buffer.from('export const a=1;\n')},
  {path:'.github/workflows/a.yml',
    body:Buffer.from('steps:\n  - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09\n')}
];
const file=(path,text)=>({path,body:Buffer.from(text)});
test('both passes traverse every byte and yield matching whole-file manifest',()=>{
  const technical=inspectTrackedFiles(base(),'technical');
  const security=inspectTrackedFiles(base(),'security');
  assert.equal(technical.fileCount,2);
  assert.equal(security.fileCount,2);
  assert.equal(technical.manifestSha256,security.manifestSha256);
  assert.deepEqual(technical.errors,[]);
  assert.deepEqual(security.errors,[]);
});
test('technical pass catches forged JSON and casefold paths',()=>{
  const s=inspectTrackedFiles([...base(),
    file('docs/bad.json','{"x":}'),file('Apps/web/components/A.tsx','hi')],'technical');
  assert.deepEqual(s.errors.map(x=>x.rule).sort(),['CASE_COLLISION','INVALID_JSON']);
});
test('security pass catches untrusted workflow triggers and unpinned Actions',()=>{
  const s=inspectTrackedFiles([...base(),file('.github/workflows/bad.yml',
    'on:\n  pull_request_target:\nsteps:\n  - uses: actions/checkout@v5\n')],'security');
  assert.ok(s.errors.some(x=>x.rule==='PRIVILEGED_FORK_TRIGGER'));
  assert.ok(s.errors.some(x=>x.rule==='UNPINNED_ACTION'));
});
test('security pass refuses tracked credentials, private keys and browser DB access',()=>{
  const s=inspectTrackedFiles([...base(),
    file('.env.production','token=fake'),
    file('lib/bad.ts','const key="-----BEGIN PRIVATE KEY-----";'),
    file('apps/web/app/(console)/admin/research/page.tsx',
      'const db=process.env.SUPABASE_SERVICE_ROLE_KEY')],'security');
  for(const type of ['TRACKED_SECRET_FILE','PRIVATE_KEY_LITERAL','PRIVILEGED_BROWSER_ROUTE'])
    assert.ok(s.errors.some(x=>x.rule===type),type);
});
test('invalid pass and record type refused',()=>{
  assert.throws(()=>inspectTrackedFiles(base(),'other'),TypeError);
  assert.throws(()=>inspectTrackedFiles([{path:'bad',body:'not bytes'}],'security'),TypeError);
});
