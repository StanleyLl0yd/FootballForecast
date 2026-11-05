import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('public dashboard reports current M2 without inventing model accuracy',()=>{
  const dashboard=read('../app/(console)/dashboard/page.tsx');
  assert.match(dashboard,/Текущий этап: M2 · 5\/8/);
  assert.doesNotMatch(dashboard,/Текущий этап: M1/);
  assert.match(dashboard,/семь сезонов РПЛ 2018\/19–2024\/25/);
  assert.match(dashboard,/Публичная витрина охватывает матчи/);
  assert.match(dashboard,/train-only/);
  assert.match(dashboard,/Оценка на независимом сезоне 2025\/26 ещё не проводилась/);
  assert.match(dashboard,/Footbolno \(CC BY 4\.0\)/);
  assert.match(dashboard,/href="https:\/\/footbolno\.ru\/otkrytye-dannye"/);
  assert.match(dashboard,/Опубликованных прогнозов/);
});

test('owner login and unconfigured setup show active M2 status',()=>{
  for(const path of ['../app/login/page.tsx','../app/setup/page.tsx']){
    const view=read(path);
    assert.match(view,/M2 · В РАБОТЕ/);
    assert.doesNotMatch(view,/M1 ПРИНЯТ/);
  }
  assert.match(read('../app/login/page.tsx'),/LoginButton/);
});
