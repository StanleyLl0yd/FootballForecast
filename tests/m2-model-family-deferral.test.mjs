import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const protocol=read('../docs/M2_BASELINE_PROTOCOL.md');
const readme=read('../README.md');
const roadmap=read('../ROADMAP.md');
const page=read('../apps/web/app/(console)/models/page.tsx');

test('M2 conditional family decision defers unvalidated Elo/Dixon–Coles without opening holdout',()=>{
  assert.match(protocol,/Conditional model-family decision — 2026-11-02/);
  for(const prerequisite of [
    '2024/25','2025/26','2026/27','240-match','sealed_holdout',
    'no leaderboard','deferred','M3 remains unauthorized',
    'does **not** close the separate source-verification'
  ])assert.ok(protocol.includes(prerequisite),prerequisite);
  assert.match(protocol,/cannot be used for Elo\/Dixon–Coles selection/);
  assert.match(protocol,/future single fixed-Poisson non-strict retrospective scoring/);
  assert.doesNotMatch(protocol,/Elo\/Dixon–Coles (?:outperformed|improved|beat)/i);
});

test('model-family deferral updates public milestone progress without asserting accuracy',()=>{
  assert.match(page,/<strong>4\/8<\/strong><small>4 блока/);
  assert.match(page,/не сравнение их точности/);
  assert.match(readme,/M2 4\/8; четыре задачи остаются открытыми/);
  assert.match(roadmap,/M2 remains OPEN 4\/8/);
  assert.match(roadmap,/no approved or retained model and no public forecast exists/);
  assert.match(readme,/holdout использовать для подбора запрещено/);
  assert.doesNotMatch(page,/Модели обучены и опубликованы|точность доказана/);
});
