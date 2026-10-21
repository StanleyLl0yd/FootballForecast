import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=p=>JSON.parse(readFileSync(new URL('../docs/'+p,import.meta.url),'utf8'));
const evidence=read('M0_WIKIMEDIA_RPL_HOLDOUT_RESEARCH.json');
const registry=read('M0_FREE_SOURCE_REGISTRY.json');
const minimum=read('M0_MINIMUM_RPL_SCOPE.json');
const foot=read('M0_FOOTBOLNO_RPL_AGGREGATE_EVIDENCE.json');

test('Wikipedia 2025/26 article provides a research-only full 16x16 results matrix',()=>{
  assert.equal(evidence.schemaVersion,1);
  assert.equal(evidence.candidateId,'wikipedia');
  assert.equal(evidence.assumedCostUSD,0);
  const h=evidence.holdout;
  assert.equal(h.season,'2025/2026');
  assert.ok(minimum.minimumScope.some(s=>s.season===h.season&&s.role==='sealed_holdout'));
  assert.match(h.wikipediaArticle,/^https:\/\/ru\.wikipedia\.org\/wiki\//);
  assert.match(h.pinnedRevisionUrl,/^https:\/\/ru\.wikipedia\.org\/w\/index\.php\?oldid=\d+$/);
  assert.equal(h.pinnedArticleRevision,154250193);
  assert.equal(h.clubRowsObserved,16);
  assert.equal(h.competitorsObserved,16);
  assert.equal(h.excludedSelfFixtures,16);
  assert.equal(h.filledScoreCellsObserved,16*16-16);
  assert.equal(h.publisherReportedCompletedMatches,240);
  assert.equal(h.publisherReportedGoals,609);
  const foo=foot.seasons.find(s=>s.season===h.season);
  assert.ok(foo);
  assert.equal(foo.statuses.finished,240);
  assert.equal(foo.sourceReportedScoresNotAuthenticatedOnField.home+
    foo.sourceReportedScoresNotAuthenticatedOnField.away,609);
  for(const field of ['strictAsOfPregameSnapshotsAuthenticated',
    'individualKickoffTimestampInMatrix','matchLevelReferenceReconciled',
    'upstreamIndependenceFromFootbolnoOrRpl','exactReproducibleRevisionContentDownloadedOrHashed'])
    assert.equal(h[field],false,field);
});
test('2026/27 Wikipedia article is stale and cannot supply verified current fixtures',()=>{
  const c=evidence.current;
  assert.ok(minimum.minimumScope.some(s=>s.season===c.season&&s.role==='current_live'));
  assert.equal(c.pinnedArticleRevision,154356849);
  assert.equal(c.articleStatsAsOf,'2026-08-09');
  assert.equal(c.publisherReportedFinishedMatchesAtThatAsOf,23);
  assert.equal(c.publisherReportedGoalsAtThatAsOf,65);
  assert.equal(c.sourceNotFreshForDate,'2026-10-21');
  assert.equal(c.sourceNotFreshForRealtimeFixtures,true);
});
test('free Wikimedia API research must honor User Agent, 2026 request quotas and ShareAlike',()=>{
  assert.match(evidence.licenseUrl,/creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.match(evidence.publisherReusePolicy,/mediawiki\.org/);
  assert.deepEqual([
    evidence.apiSafety.unidentifiedAutomatedRequestsPerMinuteDocumented,
    evidence.apiSafety.identifiedUserAgentOnlyRequestsPerMinuteDocumented,
    evidence.apiSafety.maxConcurrentRequestsRecommended
  ],[10,200,3]);
  for(const key of ['notCalledOrIntegrated','followRetryAfterOn429',
    'requiresMeaningfulContactUserAgent','requiresAttributionAndShareAlikeReview',
    'noQuotaBypassOrHighVolume','noPaidEnterpriseFallback'])
    assert.equal(evidence.apiSafety[key],true,key);
});
test('Wikimedia content license alone cannot waive original-source and chronology checks',()=>{
  for(const [key,value]of Object.entries(evidence.gates))
    assert.equal(value,false,key);
  const s=registry.sources.find(r=>r.id==='wikipedia');
  assert.ok(s);
  assert.equal(s.priority,4);
  assert.equal(s.active,false);
  assert.equal(s.authorizedAutomatedTraining,false);
  assert.equal(s.authorizedRawRepublication,false);
  assert.ok(s.roles.includes('historical-results'));
  assert.match(s.rights,/sharealike/);
  assert.equal(registry.policy.activeProviderIntegrations,0);
  for(const key of ['matches','results','fixtures','matchRows','rawScores'])
    assert.equal(Object.hasOwn(evidence,key),false,key);
  const docs=readFileSync(new URL('../docs/DATA_SOURCES.md',import.meta.url),'utf8');
  assert.match(docs,/M0_WIKIMEDIA_RPL_HOLDOUT_RESEARCH\.json/);
  assert.match(docs,/16 × 15|16×15/);
  assert.match(evidence.limitations,/kickoff dates/);
});
