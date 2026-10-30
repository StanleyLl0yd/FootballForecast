// Default-deny autonomy gate for the exact aggregate-only private revision report.
import {readFileSync,openSync,closeSync,fstatSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
const fields=['added','removed','name_changes','source_id_changes','calendar_changes',
  'finished_regressions'];
export function decideCurrentRefresh(r){
  if(!r||r.kind!=='M1_PRIVATE_REVISION_PREVIEW'||r.candidateRows!==720||
    r.autoUpdatesEnabled!==false||r.historicalAsOfVerified!==false||
    !Array.isArray(r.seasons)||r.seasons.length!==3||
    !r.changeCounts||typeof r.requiresReview!=='boolean')
    throw Error('Invalid private aggregate report');
  const c=r.changeCounts;
  const fresh=c.newly_confirmed_times,final=c.newly_finished;
  const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=720;
  const keys=[...fields,'unchanged','modified','score_changes','status_changes',
    'kickoff_changes','historical_train_or_holdout_changes',
    'newly_confirmed_times','newly_finished'];
  if(keys.some(k=>!valid(c[k]))||c.unchanged+c.modified+c.added!==720)
    throw Error('Invalid aggregate counts');
  // This decision is advisory. PostgreSQL repeats every invariant under a
  // serialized advisory lock and atomically refuses on any changed source field.
  const clean=c.modified===0 && c.added===0 && c.removed===0 &&
    c.unchanged===720&&!r.requiresReview;
  if(clean)return 'NO_CHANGE';
  const historicalClean=r.seasons.slice(0,2).every(s=>
    s.modified===0&&s.added===0&&s.removed===0&&s.unchanged===240);
  const safe=historicalClean&&
    r.seasons[2]?.season==='2026/2027'&&
    r.seasons[2].modified===c.modified&&
    r.seasons[2].added===0&&r.seasons[2].removed===0&&
    c.historical_train_or_holdout_changes===0&&
    fields.every(k=>c[k]===0)&&
    c.status_changes===final&&c.score_changes===final&&
    c.kickoff_changes===fresh&&
    c.modified===fresh+final&&c.modified>0&&r.requiresReview;
  return safe?'SAFE_CURRENT_ONLY':'REVIEW_REQUIRED';
}
export function sanitizeRefreshOutcome(data,decision){
  if(decision!=='SAFE_CURRENT_ONLY'||!data||typeof data!=='object'||
    Array.isArray(data)||data.automatic_refresh_enabled!==false||
    data.historical_as_of_verified!==false||
    data.already_published!==false||
    data.historical_or_holdout_updates!==0||
    !Number.isInteger(data.public_links)||data.public_links<480||
    data.public_links>720||
    !Number.isSafeInteger(data.newly_confirmed_scheduled)||
    !Number.isSafeInteger(data.scheduled_to_finished)||
    data.newly_confirmed_scheduled<0||data.scheduled_to_finished<0||
    data.newly_confirmed_scheduled+data.scheduled_to_finished===0)
    throw Error('Invalid guarded current refresh outcome');
  return {kind:'M1_AUTONOMOUS_GUARDED_REFRESH',outcome:'CURRENT_ONLY_APPLIED',
    publicLinks:data.public_links,
    newlyConfirmedTimes:data.newly_confirmed_scheduled,
    newFinishedResults:data.scheduled_to_finished,
    historicalOrHoldoutWrites:0,
    autoUpdatesEnabled:false,
    rawRecordsPrinted:0};
}
function safeRead(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const info=fstatSync(fd);
    if(!info.isFile()||info.size<2||info.size>16384)
      throw Error('Invalid bounded private report');
    return JSON.parse(readFileSync(fd,'utf8'));
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const mode=process.argv[2];
    if(process.argv.length!==4||!['decision','outcome'].includes(mode))
      throw Error('Unsupported report operation');
    const report=safeRead(process.argv[3]);
    const result=mode==='decision'?decideCurrentRefresh(report):
      sanitizeRefreshOutcome(report,'SAFE_CURRENT_ONLY');
    process.stdout.write((typeof result==='string'?result:JSON.stringify(result))+'\n');
  }catch{
    console.error('FAIL: protected refresh classification refused (no provider rows or secrets logged)');
    process.exitCode=2;
  }
}
