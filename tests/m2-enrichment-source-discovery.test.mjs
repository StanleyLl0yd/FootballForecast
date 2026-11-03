import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {examineSstatsCatalog,examineSstatsGames,describeSstatsCatalogEnvelope,describeSstatsCatalogPayload} from
  '../scripts/m2-sstats-free-source-catalog.mjs';
import {inspectPreviousDayWeather} from
  '../scripts/m2-weather-previous-runs-probe.mjs';

const OBSERVED='2026-11-03T18:00:00Z';
const LEAGUES={data:[
  {id:235,name:'Premier League',country:{name:'Russia'}},
  {id:50,name:'Premier League',country:{name:'England'}},
  {id:60,name:'First League',country:{name:'Russia'}}
]};
const weather=()=>({
  latitude:59.94,longitude:30.31,timezone:'GMT',
  hourly_units:{temperature_2m_previous_day1:'°C'},
  hourly:{time:Array.from({length:24},(_,i)=>
    '2024-08-01T'+String(i).padStart(2,'0')+':00'),
    temperature_2m_previous_day1:Array.from({length:24},(_,i)=>i/2)}
});
test('league candidate stays private to runner; no league IDs in aggregate logs',()=>{
  const r=examineSstatsCatalog(LEAGUES,OBSERVED);
  assert.equal(r.leagueRowsSeen,3);
  assert.equal(r.russianPremierCandidates,1);
  assert.equal(r._internalLeagueId,235);
  const {_internalLeagueId,...aggregate}=r;
  assert.doesNotMatch(JSON.stringify(aggregate),/235|Premier League|Russia/);
  assert.equal(aggregate.rplHistoricalMatchCoverageVerified,false);
  assert.equal(aggregate.rightsForTrainingVerified,false);
});
test('unrecognized API envelope yields safe shape-only evidence, not a guessed league',()=>{
  const response={
    status:'error',
    message:'SECRET MESSAGE user@example.test PRIVATE API RESPONSE',
    data:{events:[{id:12345,name:'SECRET CLUB'}],PageSize:1},
    TotalCount:1,
  };
  assert.throws(()=>examineSstatsCatalog(response,OBSERVED),/INCONCLUSIVE/);
  const result=describeSstatsCatalogEnvelope(response,OBSERVED);
  assert.equal(result.kind,'M2_SSTATS_PUBLIC_CATALOG_ENVELOPE_DIAGNOSTIC');
  assert.equal(result.rootType,'object');
  assert.equal(result.dataType,'object');
  assert.equal(result.nestedArraysCount,1);
  assert.deepEqual(result.nestedArrayLengths,[1]);
  assert.equal(result.recognizedKeyPresence.message,true);
  assert.equal(result.statusClass,'error');
  assert.equal(result.sourceIdentifiersLogged,false);
  assert.doesNotMatch(JSON.stringify(result),/SECRET|PRIVATE|12345|user@example/);
});

test('safe invalid JSON catalog diagnostic never exposes response text',()=>{
  for(const [raw,expected] of [
    ['<!doctype html><html>SECRET PRIVATE ID 54321</html>','HTML_LIKE'],
    ['{"secret":"PRIVATE TOKEN 54321"','JSON_PREFIX_INVALID'],
    ['blocked: PRIVATE 54321','OTHER_NON_JSON'],
  ]){
    const report=describeSstatsCatalogPayload(Buffer.from(raw),OBSERVED);
    assert.equal(report.payloadClass,expected);
    assert.equal(report.jsonParseStatus,'INVALID_JSON');
    assert.equal(report.responseBytes,Buffer.byteLength(raw));
    assert.match(report.responseSha256,/^[a-f0-9]{64}$/);
    assert.equal(report.sealedHoldoutRead,false);
    assert.doesNotMatch(JSON.stringify(report),/SECRET|PRIVATE|54321|TOKEN/);
  }
  assert.throws(()=>describeSstatsCatalogPayload(Buffer.alloc(1),OBSERVED),/INCONCLUSIVE/);
});
test('ambiguous, absent or malformed league catalog cannot pick an ID',()=>{
  const ambiguous={data:[LEAGUES.data[0],{id:236,name:'Russian Premier',country:'Russia'}]};
  assert.equal(examineSstatsCatalog(ambiguous,OBSERVED)._internalLeagueId,null);
  assert.equal(examineSstatsCatalog({data:[LEAGUES.data[1]]},OBSERVED)._internalLeagueId,null);
  for(const doc of [null,{data:[]},{data:{}},{data:Array(5001).fill({})}])
    assert.throws(()=>examineSstatsCatalog(doc,OBSERVED),/INCONCLUSIVE/);
});
test('only presence counts of match fields, no odds or player data emitted',()=>{
  const rows=[{id:110,homeTeam:'PRIVATE CLUB',xg:{home:1.1},
    lineups:[{player:'PRIVATE PLAYER'}],prematchOdds:{home:2.1}},
    {id:111,homeTeam:'OTHER PRIVATE CLUB',shots:{home:9},stadium:'SECRET VENUE'}];
  const r=examineSstatsGames({data:rows},OBSERVED);
  assert.equal(r.returnedSampleRows,2);
  assert.equal(r.fieldsDetectedRowCounts.xg,1);
  assert.equal(r.fieldsDetectedRowCounts.prematchOdds,1);
  assert.equal(r.fieldsDetectedRowCounts.lineups,1);
  assert.equal(r.fieldsDetectedRowCounts.shots,1);
  assert.equal(r.fieldsDetectedRowCounts.venue,1);
  assert.equal(r.fullSeasonCoverageVerified,false);
  assert.equal(r.quoteHistoricalAsOfVerified,false);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE|SECRET|110|111/);
  assert.throws(()=>examineSstatsGames({data:[null]},OBSERVED),/INCONCLUSIVE/);
});
test('previous-day lead-time temperature sample has no actual values in report',()=>{
  const r=inspectPreviousDayWeather(weather(),OBSERVED);
  assert.equal(r.nonNullTemperatureHours,24);
  assert.equal(r.previousLeadDays,1);
  assert.equal(r.historicalMatchFeatureApproved,false);
  assert.equal(r.verifiedModelInitializationTimestamp,false);
  assert.equal(r.sealedHoldoutRead,false);
  assert.doesNotMatch(JSON.stringify(r),/temperature_2m_previous_day1|11.5/);
});
test('reject shifted time, missing lead and falsified location/timezone',()=>{
  for(const change of [
    w=>w.hourly.time[0]='2024-08-02T00:00',
    w=>w.hourly.temperature_2m_previous_day1.pop(),
    w=>w.hourly.temperature_2m_previous_day1[0]=1000,
    w=>w.timezone='Europe/Moscow',
    w=>w.latitude=55.75,
    w=>{delete w.hourly.temperature_2m_previous_day1}
  ]){
    const w=weather();change(w);
    assert.throws(()=>inspectPreviousDayWeather(w,OBSERVED),/INCONCLUSIVE/);
  }
});
test('all four bounded external requests fail closed on curl transport/size-limit errors',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/m2-enrichment-source-discovery.yml',
    import.meta.url),'utf8');
  assert.equal((yaml.match(/if ! status="\$\(curl/g)||[]).length,4);
  assert.doesNotMatch(yaml,/2>\/dev\/null \|\| true/);
  for(const state of [
    'M2_SSTATS_CATALOG=INCONCLUSIVE_TRANSFER',
    'M2_SSTATS_GAMES=INCONCLUSIVE_TRANSFER',
    'M2_WEATHER_PREVIOUS_DAY=INCONCLUSIVE_TRANSFER',
    'rm -f "$file"',
  ])assert.ok(yaml.includes(state),state);
  assert.match(yaml,/--max-filesize 1500000/);
  assert.match(yaml,/--max-filesize 60000/);
});
test('manual discovery workflow is owner-only, exactly bounded, no holdout or upload',()=>{
  const yaml=readFileSync(new URL(
    '../.github/workflows/m2-enrichment-source-discovery.yml',import.meta.url),'utf8');
  for(const [name,command,flag] of [
    ['sstats-rpl-catalog','/m2-sstats-catalog','AUDIT_SSTATS_RPL_CATALOG'],
    ['weather-previous-day-reference','/m2-weather-previous-day','AUDIT_WEATHER_PREVIOUS_DAY']
  ]){
    const start=yaml.indexOf('  '+name+':');
    assert.ok(start>0);
    const job=yaml.slice(start).split(/\n  [a-z][a-z0-9-]*:\n/)[0];
    for(const check of [
      "github.repository == 'StanleyLl0yd/FootballForecast'",
      "github.ref == 'refs/heads/main'",
      "github.actor == 'StanleyLl0yd'",
      "github.event.issue.number == 182",
      "github.event.comment.author_association == 'OWNER'",
      "github.event.comment.body == '"+command+"'",
      flag,'--max-redirs 0','--max-filesize','persist-credentials: false'
    ])assert.ok(job.includes(check),check);
    assert.doesNotMatch(job,/2025\/26|2025%2F26|upload-artifact|[?&]cursor=|git push|set -x|apikey=/);
  }
  assert.match(yaml,/https:\/\/api\.sstats\.net\/Leagues/);
  assert.match(yaml,/https:\/\/api\.sstats\.net\/Games\/list/);
  assert.match(yaml,/https:\/\/previous-runs-api\.open-meteo\.com\/v1\/forecast/);
  assert.doesNotMatch(yaml,/historical-forecast-api\.open-meteo\.com|archive-api\.open-meteo\.com/);
});
