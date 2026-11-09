import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const owner=read('../app/(console)/admin/research/page.tsx');
const models=read('../app/(console)/models/page.tsx');
const admin=read('../app/(console)/admin/page.tsx');
const archive=JSON.parse(read('../../../docs/M2_PRIVATE_RPL_HISTORY_EVIDENCE.json'));
const cc0=JSON.parse(read('../../../docs/M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json'));
const anomalies=JSON.parse(read('../../../docs/M2_CC0_RPL_ANOMALY_CORROBORATION_EVIDENCE.json'));

test('M3 owner UI remains authenticated and source-only, without training or data reads',()=>{
  const auth=owner.indexOf('await requireOwner()');
  const review=owner.indexOf('const m3References=');
  assert.ok(auth>=0 && review>auth);
  assert.match(owner,/export const dynamic='force-dynamic'/);
  assert.match(owner,/Этап M3 · калибровка<\/span><strong>2\/8<\/strong>/);
  assert.match(owner,/М3-A3|M3-A3/);
  assert.match(owner,/0 независимо подтверждённых пригодных строк/);
  const start=owner.indexOf('<h2>M3 · Семилетний архив');
  const end=owner.indexOf('<h2>Контроль M2');
  assert.ok(start>=0 && end>start);
  const panel=owner.slice(start,end);
  assert.match(panel,/m3EvidenceConsistent/);
  assert.match(panel,/m3Archive.seasons.map/);
  assert.match(panel,/m3References.find/);
  assert.match(panel,/М3-A3|M3-A3/);
  assert.match(panel,/M3_SOURCE_READINESS_2026-11-09.md/);
  assert.match(panel,/не сопоставлен с приватным источником/);
  assert.doesNotMatch(panel,/fetch\s*\(|supabase|service_role|INSERT INTO|DELETE FROM|UPDATE ff_|2025\/26.*(?:оценить заново|повторно оценить)/i);
});

test('UI receives only already public source-summary JSON with correct boundaries',()=>{
  assert.equal(archive.databaseVerification.matchCount,1680);
  assert.equal(archive.databaseVerification.snapshotCount,7);
  assert.equal(archive.databaseVerification.sealedHoldoutRead,false);
  assert.equal(archive.run.importReceipt.sourceOnly,true);
  assert.equal(archive.run.importReceipt.modelTrainingApproved,false);
  assert.equal(cc0.developmentSeasonsObserved.length,5);
  assert.equal(cc0.developmentSeasonsObserved.reduce((n,r)=>n+r.structuralMatchRows,0),1200);
  assert.deepEqual(cc0.unavailableInCheckedCc0RplPaths,['2021/22','2022/23']);
  assert.equal(anomalies.awarded.independentlyCorroboratedAsNotPlayed,6);
  assert.equal(cc0.developmentSeasonsObserved.reduce((n,r)=>
    n+r.rowsWithoutExplicitClockTime,0),47);
  assert.equal(archive.databaseVerification.publicForecastCount,0);
});

test('M2 accepted and M3 open are no longer contradicted on three product pages',()=>{
  for(const page of [owner,models,admin]){
    assert.doesNotMatch(page,/M3 (?:не разрешён|не разрешены|не разрешено|остаётся запрещён)/i);
  }
  assert.match(models,/M3 открыт, 2\/8 критериев выполнены/);
  assert.match(models,/исключительно из синтетических матчей/);
  assert.match(models,/Защищённый контроль M3/);
  assert.match(admin,/M3 отдельно открыт для приватной исследовательской разработки/);
  assert.match(owner,/M2 · принятое и оставшиеся ограничения/);
  assert.match(owner,/Повторное использование 2025\/26 запрещено/);
});
