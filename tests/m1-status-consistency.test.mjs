import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const readme=read('../README.md');
const shell=read('../apps/web/components/shell.tsx');

test('public shell and README acknowledge accepted M0 and open M1 without inventing models',()=>{
  assert.match(shell,/M1 · Проверенные матчи/);
  assert.doesNotMatch(shell,/M0 · Подготовка данных/);
  assert.match(readme,/M1 OPEN/);
  assert.match(readme,/M0 принят 29\.10\.2026/);
  assert.match(readme,/720 реальных записей Footbolno \(CC BY 4\.0\)/);
  assert.match(readme,/616 матчей опубликованы/);
  assert.match(readme,/104 будущих матча/);
  assert.match(readme,/Обученных моделей, опубликованных прогнозов и подтверждённой точности пока нет/);
  assert.match(readme,/M2.*ещё не начат/);
  assert.doesNotMatch(readme,/База РПЛ ещё пустая|Статус: M0, разработка|M1 начинается исключительно/);
});
