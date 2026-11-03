// Open-Meteo Previous Runs: fixed 24h lead-time reference-location observation.
// Never treats a stitched forecast or reanalysis as pre-match data.
import {createHash} from 'node:crypto';
import {constants,openSync,closeSync,fstatSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const fail=()=>{throw Error('INCONCLUSIVE_PREVIOUS_RUNS_SCHEMA');};
const sha=b=>createHash('sha256').update(b).digest('hex');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function inspectPreviousDayWeather(doc,observedAtUtc){
  if(!obj(doc)||!obj(doc.hourly)||!obj(doc.hourly_units)||
    !['GMT','UTC'].includes(doc.timezone)||
    typeof doc.latitude!=='number'||Math.abs(doc.latitude-59.93)>0.5||
    typeof doc.longitude!=='number'||Math.abs(doc.longitude-30.31)>0.5||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observedAtUtc)||
    Number.isNaN(Date.parse(observedAtUtc)))fail();
  const timestamps=doc.hourly.time;
  const values=doc.hourly.temperature_2m_previous_day1;
  if(!Array.isArray(timestamps)||timestamps.length!==24||
    !Array.isArray(values)||values.length!==timestamps.length||
    !['°C','°F'].includes(doc.hourly_units.temperature_2m_previous_day1))fail();
  let finite=0,missing=0;
  for(let i=0;i<24;i++){
    const expected='2024-08-01T'+String(i).padStart(2,'0')+':00';
    if(timestamps[i]!==expected)fail();
    const v=values[i];
    if(v===null)missing++;
    else if(typeof v==='number'&&Number.isFinite(v)&&v>=-110&&v<=65)finite++;
    else fail();
  }
  return Object.freeze({
    schemaVersion:1,kind:'M2_WEATHER_PREVIOUS_DAY_REFERENCE_SAMPLE',
    observedAtUtc,
    source:'Open-Meteo Previous Runs API',
    validDate:'2024-08-01',validHours:24,
    nonNullTemperatureHours:finite,missingTemperatureHours:missing,
    previousLeadDays:1,
    testLocation:'SAINT_PETERSBURG_REFERENCE_NOT_CONFIRMED_STADIUM',
    fixedLeadTimeCandidate:true,
    verifiedModelInitializationTimestamp:false,
    independentlyVerifiedVenueHistory:false,
    historicalMatchFeatureApproved:false,
    sealedHoldoutRead:false,
    rawTemperatureValuesLogged:false,
  });
}
function safe(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const st=fstatSync(fd);
    if(!st.isFile()||st.size<2||st.size>50000)fail();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)fail();
    const raw=safe(process.argv[2]);
    const x=inspectPreviousDayWeather(JSON.parse(raw.toString('utf8')),process.argv[3]);
    console.log(JSON.stringify({...x,responseSha256:sha(raw)}));
  }catch{
    console.error('M2 fixed-lead weather sample inconclusive; no weather values emitted');
    process.exitCode=2;
  }
}
