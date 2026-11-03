// Seven fixed JMA GSM 24-hour-lead reference-weather samples. No RPL venue linkage.
import {createHash} from 'node:crypto';
import {constants,closeSync,fstatSync,openSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const YEARS=Object.freeze([2018,2019,2020,2021,2022,2023,2024]);
const FAIL=()=>{throw Error('M2 previous-runs yearly sample invalid');};
const sha=b=>createHash('sha256').update(b).digest('hex');
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function atUTC(x){
  return typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)&&
    !Number.isNaN(Date.parse(x));
}
export function summarizeWeatherYear(doc,year){
  if(!YEARS.includes(year)||!isObj(doc)||!isObj(doc.hourly)||
     !isObj(doc.hourly_units)||!['UTC','GMT'].includes(doc.timezone)||
     typeof doc.latitude!=='number'||typeof doc.longitude!=='number'||
     Math.abs(doc.latitude-59.93)>0.5||Math.abs(doc.longitude-30.31)>0.5)FAIL();
  const t=doc.hourly.time,vals=doc.hourly.temperature_2m_previous_day1;
  if(!Array.isArray(t)||t.length!==24||!Array.isArray(vals)||vals.length!==24||
     !['°C','°F'].includes(doc.hourly_units.temperature_2m_previous_day1))FAIL();
  let nonNull=0;
  for(let h=0;h<24;h++){
    if(t[h]!==year+'-08-01T'+String(h).padStart(2,'0')+':00')FAIL();
    const v=vals[h];
    if(v===null)continue;
    if(typeof v!=='number'||!Number.isFinite(v)||v< -110||v>65)FAIL();
    nonNull++;
  }
  return Object.freeze({year,day:year+'-08-01',validHours:24,
    nonNullTemperatureHours:nonNull,missingTemperatureHours:24-nonNull,
    sampleStatus:nonNull===24?'FULL_24_OF_24':nonNull===0?'NO_NONNULL_HOURS':'PARTIAL_NONNULL_HOURS'});
}
function readSafe(file){
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>60000)FAIL();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
export function aggregateSevenWeatherYears(entries,observedAtUtc){
  if(!atUTC(observedAtUtc)||!Array.isArray(entries)||entries.length!==7||
     entries.some((e,i)=>e.year!==YEARS[i]||
       !['FULL_24_OF_24','NO_NONNULL_HOURS','PARTIAL_NONNULL_HOURS',
         'HTTP_UNAVAILABLE','INCONCLUSIVE_SCHEMA'].includes(e.sampleStatus)))FAIL();
  return Object.freeze({schemaVersion:1,
    kind:'M2_JMA_GSM_SEVEN_YEAR_FIXED_LEAD_WEATHER_REFERENCE_SAMPLE',
    observedAtUtc,provider:'Open-Meteo Previous Runs',
    modelRequested:'jma_gsm',leadTimeHours:24,
    location:'SAINT_PETERSBURG_CITY_REFERENCE_NOT_STADIUM',
    years:entries,requestCount:7,successful24HourYears:entries.filter(e=>
      e.sampleStatus==='FULL_24_OF_24').length,
    sourceHistoricalMatchCoverageVerified:false,
    individualModelInitializationTimesVerified:false,
    venueCoordinatesVerified:false,historicalMatchWeatherTrainingApproved:false,
    sourceValuesLogged:false,rawProviderRowsRetained:false,
    sealedHoldoutRead:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)FAIL();
    const dir=process.argv[2],observed=process.argv[3],entries=[];
    const hashes=[];
    for(let i=0;i<YEARS.length;i++){
      const year=YEARS[i],name=String(i+1).padStart(2,'0');
      const file=join(dir,name+'.json');
      let entry;
      try{
        const raw=readSafe(file);
        hashes.push(sha(raw));
        try{
          entry=summarizeWeatherYear(JSON.parse(raw.toString('utf8')),year);
        }catch{
          entry={year,day:year+'-08-01',sampleStatus:'INCONCLUSIVE_SCHEMA'};
        }
      }catch(e){
        if(e?.code!=='ENOENT')throw e;
        hashes.push(null);
        entry={year,day:year+'-08-01',sampleStatus:'HTTP_UNAVAILABLE'};
      }
      entries.push(entry);
    }
    console.log(JSON.stringify({...aggregateSevenWeatherYears(entries,observed),
      pageHashesSha256:sha(JSON.stringify(hashes))}));
  }catch{
    console.error('M2 yearly historical weather observation inconclusive; no weather values emitted');
    process.exitCode=2;
  }
}
