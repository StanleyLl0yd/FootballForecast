import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeWeatherYear,aggregateSevenWeatherYears} from
  '../scripts/m2-weather-seven-year-reference.mjs';

const OBSERVED='2026-11-03T18:30:00Z';
const sample=year=>({
  latitude:59.94,longitude:30.31,timezone:'GMT',
  hourly_units:{temperature_2m_previous_day1:'°C'},
  hourly:{time:Array.from({length:24},(_,h)=>year+'-08-01T'+String(h).padStart(2,'0')+':00'),
    temperature_2m_previous_day1:Array.from({length:24},(_,h)=>h/2)}
});
test('all seven reference years validate as a fixed 24-hour lead with zero source values',()=>{
  const entries=Array.from({length:7},(_,i)=>summarizeWeatherYear(sample(2018+i),2018+i));
  const r=aggregateSevenWeatherYears(entries,OBSERVED);
  assert.equal(r.requestCount,7);
  assert.equal(r.successful24HourYears,7);
  assert.equal(r.historicalMatchWeatherTrainingApproved,false);
  assert.equal(r.individualModelInitializationTimesVerified,false);
  assert.equal(r.sealedHoldoutRead,false);
  assert.doesNotMatch(JSON.stringify(r),/temperature_2m_previous_day1|11.5/);
});
test('unavailable and partial years do not lead to full historical coverage claim',()=>{
  const entries=Array.from({length:7},(_,i)=>(
    {year:2018+i,day:(2018+i)+'-08-01',sampleStatus:'HTTP_UNAVAILABLE'}
  ));
  entries[4]=summarizeWeatherYear(sample(2022),2022);
  const r=aggregateSevenWeatherYears(entries,OBSERVED);
  assert.equal(r.successful24HourYears,1);
  assert.equal(r.sourceHistoricalMatchCoverageVerified,false);
  assert.equal(r.years[0].sampleStatus,'HTTP_UNAVAILABLE');
  const bad=sample(2024);bad.hourly.temperature_2m_previous_day1[0]=null;
  assert.equal(summarizeWeatherYear(bad,2024).sampleStatus,'PARTIAL_NONNULL_HOURS');
  bad.hourly.temperature_2m_previous_day1.fill(null);
  assert.equal(summarizeWeatherYear(bad,2024).sampleStatus,'NO_NONNULL_HOURS');
});
test('reject unexpected timestamps, untrusted coordinates, missing field or sealed-year date',()=>{
  for(const mutate of [
    o=>o.hourly.time[0]='2025-08-01T00:00',
    o=>o.latitude=55.75,
    o=>o.hourly.temperature_2m_previous_day1[0]=1000,
    o=>o.hourly.temperature_2m_previous_day1.push(3),
    o=>o.timezone='Europe/Moscow',
    o=>delete o.hourly_units.temperature_2m_previous_day1,
  ]){
    const x=sample(2018);mutate(x);
    assert.throws(()=>summarizeWeatherYear(x,2018),/invalid/);
  }
  assert.throws(()=>summarizeWeatherYear(sample(2025),2025),/invalid/);
  assert.throws(()=>aggregateSevenWeatherYears([],OBSERVED),/invalid/);
});
test('owner-only seven-request workflow does not access holdout, matches or paid sources',()=>{
  const yaml=readFileSync(new URL('../.github/workflows/m2-enrichment-source-discovery.yml',
    import.meta.url),'utf8');
  const idx=yaml.indexOf('  weather-seven-year-coverage:');
  assert.ok(idx>0);
  const job=yaml.slice(idx);
  for(const token of [
    "github.repository == 'StanleyLl0yd/FootballForecast'",
    "github.ref == 'refs/heads/main'",
    "github.actor == 'StanleyLl0yd'",
    "inputs.weather_years == 'AUDIT_WEATHER_2018_2024'",
    "github.event.issue.number == 182",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/m2-weather-seven-years'",
    '2018 2019 2020 2021 2022 2023 2024',
    "models=jma_gsm",
    "m2-weather-seven-year-reference.mjs",
    "--max-redirs 0","--max-filesize 60000",
    "persist-credentials: false"
  ])assert.ok(job.includes(token),token);
  assert.doesNotMatch(job,/2025\/26|2025-08-01|upload-artifact|git push|set -x|[?&]cursor=|apikey=/);
});
