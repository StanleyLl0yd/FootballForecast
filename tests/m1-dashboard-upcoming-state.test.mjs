import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dashboard=readFileSync(new URL('../apps/web/app/(console)/dashboard/page.tsx',import.meta.url),'utf8');

test('dashboard does not call a populated catalog empty when no future confirmed fixture exists',()=>{
  assert.match(dashboard,/Нет ближайших матчей с подтверждённым временем/);
  assert.match(dashboard,/Исторические результаты уже доступны/);
  assert.doesNotMatch(dashboard,/Расписание ещё не загружено|После проверки источника здесь появятся реальные матчи/);
});

test('unconfigured and unavailable states are distinct from ready but no future kickoff',()=>{
  assert.match(dashboard,/data\.state==='unavailable'\?'Данные недоступны'/);
  assert.match(dashboard,/data\.state==='not_configured'\?'Подключение данных не настроено'/);
  assert.match(dashboard,/Не удалось получить сведения из публичной базы/);
});
