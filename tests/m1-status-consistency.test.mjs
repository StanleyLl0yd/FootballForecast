import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const readme=read('../README.md');
const shell=read('../apps/web/components/shell.tsx');
const admin=read('../apps/web/app/(console)/admin/page.tsx');
const models=read('../apps/web/app/(console)/models/page.tsx');
const login=read('../apps/web/app/login/page.tsx');
const setup=read('../apps/web/app/setup/page.tsx');
const dataCenter=read('../apps/web/app/(console)/data/page.tsx');

test('public shell and README acknowledge accepted M0 and M1 without inventing models',()=>{
  assert.match(shell,/M2 · Принят · M3 не разрешён/);
  assert.doesNotMatch(shell,/M0 · Подготовка данных/);
  assert.match(readme,/M1 ACCEPTED \(02\.11\.2026\)/);
  assert.match(readme,/M0 принят 29\.10\.2026/);
  assert.match(readme,/M2 ACCEPTED \(09\.11\.2026\)/);
  assert.match(readme,/4 полных снимка по 720 матчей \(2880 записей\)/);
  assert.match(readme,/616 матчей \(583 завершённых, 33 запланированных\)/);
  assert.match(readme,/104 будущих матча/);
  assert.match(readme,/Утверждённых и опубликованных моделей, прогнозов и подтверждённой точности пока нет/);
  assert.match(readme,/M2 принят 09\.11\.2026/);
  assert.doesNotMatch(readme,/База РПЛ ещё пустая|Статус: M0, разработка|M1 начинается исключительно/);
});

test('owner admin page does not advertise obsolete M0 or disabled protected ingestion',()=>{
  assert.match(admin,/M1: защищённая проверка данных/);
  assert.match(admin,/GitHub Actions/);
  assert.match(admin,/Из веб-интерфейса нельзя запускать импорт/);
  assert.match(admin,/M2 принят 09\.11\.2026/);
  assert.doesNotMatch(admin,/M2 не начат/);
  assert.doesNotMatch(admin,/M0: разработка|Импорт, обучение и управление источниками остаются выключенными/);
});

test('auth and model screens accurately describe imported M1 source data and disabled training',()=>{
  assert.match(login,/АДМИНИСТРИРОВАНИЕ \/ M2 · ПРИНЯТ/);
  assert.match(dataCenter,/M1 ПРИНЯТ \/ РЕЕСТР ИСТОЧНИКОВ/);
  assert.match(dataCenter,/Этап проекта<\/span><strong>M2 принят<\/strong>/);
  assert.match(dataCenter,/M2 принят 09\.11\.2026/);
  assert.match(setup,/FOOTBALLFORECAST \/ M2 · ПРИНЯТ/);
  assert.match(models,/Обучающая выборка/);
  assert.match(models,/private escrow Poisson, TRAIN_ONLY_UNAPPROVED/);
  assert.match(models,/Один защищённый ретроспективный тест 2025\/26 выполнен/);
  const viewer=read('../apps/web/components/research-lock-viewer.tsx');
  assert.match(viewer,/Файл обрабатывается исключительно в браузере/);
  assert.doesNotMatch(viewer,/fetch\(|supabase\.from\(|createClient\(/);
  assert.doesNotMatch(models,/отсутствуют лицензированный датасет/);
});
