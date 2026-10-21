import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = path => JSON.parse(readFileSync(new URL('../docs/'+path,import.meta.url),'utf8'));
const cross = read('M0_RPL_2024_25_MINIMUM_AGGREGATE_CROSSCHECK.json');
const ff = read('M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
const open = read('M0_OPENFOOTBALL_RPL_STRUCTURAL_EVIDENCE.json');
const scope = read('M0_MINIMUM_RPL_SCOPE.json');
const registry = read('M0_FREE_SOURCE_REGISTRY.json');

test('OpenFootball and Footbolno 2024/25 independently recorded counts match',()=>{
  assert.equal(cross.kind,'M0_MINIMUM_RPL_AGGREGATE_CORROBORATION_ONLY');
  assert.equal(cross.season,'2024/2025');
  assert.ok(scope.minimumScope.some(s=>s.season===cross.season&&s.role==='train_baseline'));
  assert.equal(cross.sources.length,2);
  const by = Object.fromEntries(cross.sources.map(s=>[s.id,s]));
  const ffSeason=ff.seasons.find(s=>s.season===cross.season);
  const openSeason=open.seasons.find(s=>s.season==='2024/25');
  assert.ok(ffSeason&&openSeason);
  assert.equal(by.footbolno.researchEvidenceFile,'M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');
  assert.equal(by.footbolno.pinnedCsvSHA256,ff.sourceSHA256);
  assert.equal(by['openfootball-europe'].gitBlobSHA1,openSeason.gitBlobSHA1);
  assert.equal(by['openfootball-europe'].upstreamCommit,open.sourceCommit);
  assert.equal(by['openfootball-europe'].matches,openSeason.parsedMatches);
  assert.equal(by['openfootball-europe'].homeGoals,openSeason.sourceReportedPlayedGoals.home);
  assert.equal(by['openfootball-europe'].awayGoals,openSeason.sourceReportedPlayedGoals.away);
  assert.equal(by['openfootball-europe'].homeWins,openSeason.sourceReportedAllResultWins.home);
  assert.equal(by['openfootball-europe'].draws,openSeason.sourceReportedAllResultWins.draw);
  assert.equal(by['openfootball-europe'].awayWins,openSeason.sourceReportedAllResultWins.away);
  assert.equal(by['openfootball-europe'].draw00,20);
  for(const candidate of cross.sources){
    assert.equal(candidate.matches,240);
    assert.equal(candidate.finished,240);
    assert.equal(candidate.homeGoals,ffSeason.sourceReportedScoresNotAuthenticatedOnField.home);
    assert.equal(candidate.awayGoals,ffSeason.sourceReportedScoresNotAuthenticatedOnField.away);
    assert.equal(candidate.homeGoals+candidate.awayGoals,648);
  }
  assert.equal(by['openfootball-europe'].homeWins+by['openfootball-europe'].draws+
    by['openfootball-europe'].awayWins,240);
});
test('editorial references are aggregate corroborations, not independent licensed match data',()=>{
  assert.deepEqual(cross.editorialSummaries.map(s=>s.id),['championat','sportbox','rsssf']);
  for(const item of cross.editorialSummaries){
    assert.match(item.url,/^https:\/\//);
    assert.equal(item.matches,240);
    assert.equal(item.totalGoals,648);
    assert.equal(item.independentUpstreamVerified,false);
  }
  for(const id of ['championat','sportbox']){
    const v=cross.editorialSummaries.find(s=>s.id===id);
    assert.equal(v.homeGoals,364);
    assert.equal(v.awayGoals,284);
    assert.deepEqual([v.homeWins,v.draws,v.awayWins,v.draw00],[103,65,72,20]);
  }
});
test('OpenFootball RPL 2025/26 and current 2026/27 gaps remain explicitly unavailable',()=>{
  assert.equal(cross.coverageGap.source,'openfootball');
  assert.equal(cross.coverageGap.commitText,open.sourceCommit);
  assert.match(cross.coverageGap.commitJson,/^[a-f0-9]{40}$/);
  assert.deepEqual(cross.coverageGap.absentRplSeasonsAtPinnedCommit,
    ['2025/2026','2026/2027']);
  assert.match(cross.coverageGap.meaning,/point-in-time/);
  for(const season of cross.coverageGap.absentRplSeasonsAtPinnedCommit)
    assert.ok(scope.minimumScope.some(s=>s.season===season),'scope still requires '+season);
  assert.equal(registry.sources.find(s=>s.id==='openfootball-europe').active,false);
});
test('no aggregate parity, public license or media summary promotes ingestion/training',()=>{
  for(const [k,value]of Object.entries(cross.researchGates)){
    assert.equal(value,false,k);
  }
  assert.equal(registry.policy.activeProviderIntegrations,0);
  for(const s of registry.sources.filter(s=>['openfootball-europe','footbolno'].includes(s.id))){
    assert.equal(s.authorizedAutomatedTraining,false);
    assert.equal(s.active,false);
  }
  for(const prop of ['matches','fixtures','matchRows','scores','rawRecords']){
    assert.equal(Object.hasOwn(cross,prop),false,'no raw football records in crosscheck');
  }
  const docs=readFileSync(new URL('../docs/DATA_SOURCES.md',import.meta.url),'utf8');
  assert.match(docs,/M0_RPL_2024_25_MINIMUM_AGGREGATE_CROSSCHECK\.json/);
  assert.match(docs,/2025\/26.*OpenFootball|OpenFootball.*2025\/26/);
  assert.match(cross.limitations,/offsetting match-level errors/);
});
