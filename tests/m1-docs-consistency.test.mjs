import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const readme=read('../README.md');
const limitations=read('../docs/KNOWN_LIMITATIONS.md');
const operations=read('../docs/OPERATIONS.md');
const architecture=read('../docs/ARCHITECTURE.md');
const deploy=read('../docs/DEPLOYMENT.md');
const security=read('../SECURITY.md');

test('current M1 docs do not claim live RPL database is empty or M1 blocked',()=>{
  assert.match(readme,/M1 OPEN/);
  assert.match(readme,/второй реальный снимок/);
  assert.match(limitations,/1440 private source records|1440 приват|1440 private source|1440 private/);
  assert.match(limitations,/616/);
  assert.match(architecture,/M0 was accepted 2026-10-29/);
  assert.match(architecture,/M1 is OPEN/);
  assert.match(deploy,/m1_safe_current_refresh/);
  assert.match(security,/M0 was accepted on 2026-10-29/);
  for(const doc of [readme,limitations,operations,architecture,deploy,security])
    assert.doesNotMatch(doc,/M0 remains OPEN|M1 stays blocked|The real database is empty/);
});

test('automated sources and absence of trained model/deliveries are consistently disclosed',()=>{
  assert.match(operations,/06:17 and 18:17 UTC/);
  assert.match(operations,/07:43 UTC/);
  assert.match(operations,/Forecast creation.*model training.*remain disabled/);
  assert.match(readme,/Обученных моделей, опубликованных прогнозов и подтверждённой точности пока нет/);
  assert.match(limitations,/model training and live predictions remain disabled/);
});
