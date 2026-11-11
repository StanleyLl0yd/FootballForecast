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
const live=JSON.parse(read('../../../docs/M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json'));

test('M3 owner UI remains authenticated and source-only, without training or data reads',()=>{
  const auth=owner.indexOf('await requireOwner()');
  const review=owner.indexOf('const m3References=');
  assert.ok(auth>=0 && review>auth);
  assert.match(owner,/export const dynamic='force-dynamic'/);
  assert.match(owner,/Этап M3 · ретроспективное исследование/);
  assert.match(owner,/m3Development.state==='verified_retrospective'/);
  assert.match(owner,/M3DevelopmentWorkbench summary=\{m3Development\}/);
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
  assert.match(panel,/M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json/);
  assert.match(owner,/m3Triage.sixTechnicalAwardExactDaysAndScoreDirectionsUnique/);
  assert.match(owner,/m3TriageLimits.independentPrivateProviderIdToOfficialClubCrosswalkAccepted/);
  assert.match(panel,/Шесть уникальных кандидатов/);
  assert.match(panel,/На поле 1:1; в архиве на эту дату имеется 0:3/);
  assert.match(panel,/Два счёта 1:0 и обратный порядок клубных ID/);
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
  assert.equal(live.totalSourceFinishedRecords,1680);
  const x=live.independentPublicAndPrivateStructuralCrosschecks;
  assert.equal(x.sixTechnicalAwardExactDaysAndScoreDirectionsUnique,true);
  assert.equal(x.samePrivateHomeClubOnBoth2020OrenburgAwardDates,true);
  assert.equal(x.samePrivateAwayClubOnBoth2020SochiAwardDates,true);
  assert.equal(x.samePrivateRotorClubAsHomeAndAwayAcrossTwo2020AwardDates,true);
  assert.equal(x.theseStructuralConstraintsProveRealClubNames,false);
  assert.equal(x.officialResultRevision2022_23.privateDayCount0_3,1);
  assert.equal(x.officialResultRevision2022_23.privateDayCount1_1,0);
  assert.equal(x.officialResultRevision2022_23.privateFixtureIdentityVerified,false);
  assert.equal(x.season2023_24OfficialHomeAwaySwap.matchingPrivateReversedClubIdPairs,1);
  assert.equal(x.season2023_24OfficialHomeAwaySwap.independentExternalClubNameToPrivateIdsVerified,false);
  assert.equal(live.limitations.protectedRealModelTrainingAuthorized,false);
});

test('M3 accepted 8/8 and M4 private-only open are consistent on three product pages',()=>{
  for(const page of [owner,models,admin]){
    assert.doesNotMatch(page,/M3 (?:не разрешён|не разрешены|не разрешено|остаётся запрещён)/i);
  }
  assert.match(models,/M3 принят 8\/8 \(11\.11\.2026\); M4 открыт/);
  assert.match(models,/Пять хронологических folds проверены на реальных исторических матчах/);
  assert.match(models,/Защищённый контроль M3/);
  assert.match(admin,/M3 принят 11\.11\.2026 как закрытое ретроспективное исследование/);
  assert.match(owner,/M2 · принятое и оставшиеся ограничения/);
  assert.match(owner,/M3 принят 8\/8/);
  assert.match(models,/Публичная публикация запрещена/);
  assert.match(admin,/M4 отдельно открыт для будущих приватных shadow-прогнозов/);
  assert.match(owner,/Повторное использование 2025\/26 запрещено/);
});


test('owner only: M3 full-profile and date evidence are fail-closed aggregates',()=>{
  const auth=owner.indexOf('await requireOwner()');
  const topo=owner.indexOf('const m3Topology=inspectM3Topology');
  assert.ok(auth>=0 && topo>auth);
  assert.match(owner,/m3Topology.state==='corroborated'/);
  assert.match(owner,/m3Topology.verifiedProfileGroups/);
  assert.match(owner,/m3Topology.calendarDayCandidates/);
  assert.match(owner,/M3_CALENDAR_MASK_CROSSCHECK_2026-11-09.md/);
  assert.match(owner,/Соответствия ID и названий не доказаны/);
  assert.match(owner,/Календарь UTC и клубные ID не аттестованы/);
});
