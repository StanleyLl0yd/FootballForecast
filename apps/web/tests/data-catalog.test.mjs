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
  assert.ok(metadata.sources.length>=18);
  assert.ok([...levels.values()].every(v=>v>0));
});
test('external provider links are safe and a full-site no-account catalog remains public',()=>{
  assert.match(page,/rel="noopener noreferrer"/);
  assert.match(page,/src\.url|source\.url/);
  assert.match(page,/Этап проекта/);
  assert.match(page,/Статус исторического реестра, не M1/);
  assert.match(page,/Footbolno \(CC BY 4\.0\) импортирован/);
  assert.doesNotMatch(page,/API_KEY|secret|service_role|NEXT_PUBLIC_SUPABASE/);
});

test('historical source panel reads only pinned aggregates and labels awards correctly',()=>{
  const report=JSON.parse(readFileSync(
    new URL('../../../docs/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json',import.meta.url),'utf8'));
  assert.match(page,/import historicalEvidence from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/docs\/M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE\.json['"]/);
  assert.match(page,/historicalEvidence\.seasons\.map/);
  assert.match(page,/season\.awardedMatches/);
  assert.match(page,/season\.sourceReportedPlayedGoals/);
  assert.match(page,/season\.sourceReportedAdministrativeGoals/);
  assert.match(page,/season\.missingPairs>0/);
  assert.match(page,/Это историческая оценка OpenFootball периода M0/);
  assert.equal(report.sourceApproved,false);
  assert.equal(report.modelTrainingAllowed,false);
  assert.equal(report.empiricalMatchAccuracyMeasured,false);
  assert.equal(report.seasons.length,5);
  assert.equal(report.seasons.reduce((n,x)=>n+x.awardedMatches,0),6);
  assert.ok(report.seasons.every(x=>x.playedMatches+x.awardedMatches===x.parsedMatches));
  assert.doesNotMatch(page,/fetch\(|use client|createClient\(/);
});

test('real publisher archive panel shows only pinned aggregate statuses and no approvals',()=>{
  const footbolno=JSON.parse(readFileSync(
    new URL('../../../docs/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json',import.meta.url),'utf8'));
  const aggregate=JSON.parse(readFileSync(
    new URL('../../../docs/M0_RPL_2026_27_EDITORIAL_AGGREGATE_CROSSCHECK.json',import.meta.url),'utf8'));
  assert.match(page,/import footbolnoEvidence from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/docs\/M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE\.json['"]/);
  assert.match(page,/import currentRplCrosscheck from ['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/docs\/M0_RPL_2026_27_EDITORIAL_AGGREGATE_CROSSCHECK\.json['"]/);
  assert.match(page,/footbolnoEvidence\.seasons\.map/);
  assert.match(page,/season\.structuralResearchClassification==='QUARANTINE_ANOMALOUS_SEASON'/);
  assert.match(page,/season\.duplicateDirectedPairs>0/);
  assert.match(page,/currentRplCrosscheck\.reference\.leagueGoalsFor/);
  assert.match(page,/обучение и импорт данных запрещены на M0/);
  assert.equal(footbolno.seasons.length,11);
  assert.equal(footbolno.seasons.filter(s=>s.structuralResearchClassification==='QUARANTINE_ANOMALOUS_SEASON').length,5);
  assert.equal(footbolno.authorizedForAutomatedTraining,false);
  assert.equal(footbolno.providerRightsApproved,false);
  assert.equal(aggregate.inferences.officialMatchByMatchTruthVerified,undefined);
  assert.equal(aggregate.inferences.independentMatchLevelScoreAccuracyVerified,false);
  assert.equal(aggregate.inferences.trainingRightsApproved,false);
  assert.doesNotMatch(page,/fetch\(|createClient\(|localStorage|use client/);
});

test('M1 status credits licensed Footbolno import and preserves M0 audit context',()=>{
  assert.match(page,/M1 \/ РЕЕСТР ИСТОЧНИКОВ/);
  assert.match(page,/Footbolno \(CC BY 4\.0\) импортирован/);
  assert.match(page,/source.id==='footbolno'/);
  assert.match(page,/Не подключён/);
  assert.match(page,/опубликованных прогнозов пока нет/);
});
