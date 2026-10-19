import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const metadata=JSON.parse(readFileSync(
  new URL('../../../docs/M0_FREE_SOURCE_REGISTRY.json',import.meta.url),'utf8'));
const page=readFileSync(new URL('../app/(console)/data/page.tsx',import.meta.url),'utf8');

test('source page uses one repository registry and never copies or invents scores',()=>{
  assert.match(page,/import sourceRegistry from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/docs\/M0_FREE_SOURCE_REGISTRY\.json['"]/);
  assert.match(page,/const sources=sourceRegistry\.sources/);
  assert.match(page,/source\.empiricalResultErrorRate!==null/);
  assert.match(page,/Точность не измерена/);
  assert.match(page,/Не подключён/);
  assert.doesNotMatch(page,/use client|fetch\(|createClient\(|setInterval\(|localStorage/);
});
test('all free/reference sources map into four transparent research tiers',()=>{
  assert.equal(metadata.policy.maxMonthlySpendUSD,0);
  const levels=new Map([1,2,3,4].map(k=>[k,0]));
  for(const source of metadata.sources){
    assert.equal(source.active,false);
    assert.equal(source.empiricalResultErrorRate,null);
    assert.equal(source.authorizedAutomatedTraining,false);
    levels.set(source.priority,(levels.get(source.priority)??0)+1);
  }
  assert.equal([...levels.values()].reduce((a,b)=>a+b,0),metadata.sources.length);
  assert.equal(metadata.sources.length,19-1);
  assert.ok([...levels.values()].every(v=>v>0));
});
test('external provider links are safe and a full-site no-account catalog remains public',()=>{
  assert.match(page,/rel="noopener noreferrer"/);
  assert.match(page,/src\.url|source\.url/);
  assert.match(page,/Этап проекта/);
  assert.match(page,/Импорт данных не разрешён/);
  assert.match(page,/Ни один источник пока не одобрен/);
  assert.doesNotMatch(page,/API_KEY|secret|service_role|NEXT_PUBLIC_SUPABASE/);
});
