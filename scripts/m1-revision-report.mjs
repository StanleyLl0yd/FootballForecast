// Aggregate-only M1 revision summary; never print source rows, names or SQL.
import {openSync,readFileSync,closeSync,fstatSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';

const seasons=['2024/2025','2025/2026','2026/2027'];
const counts=['added','removed','modified','unchanged','score_changes',
  'status_changes','kickoff_changes','calendar_changes','name_changes',
  'source_id_changes','newly_confirmed_times','newly_finished',
  'finished_regressions'];
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0&&n<=1440;
function fail(){throw Error('Revision summary invalid');}

export function summarizeRevisionPreview(report){
  if(!report||typeof report!=='object'||Array.isArray(report)||
    report.candidate_rows!==720||report.auto_updates_enabled!==false||
    report.historical_as_of_verified!==false||
    typeof report.requires_review!=='boolean'||
    !Array.isArray(report.seasons)||report.seasons.length!==3)
    fail();
  const sum=report.change_counts;
  if(!sum||counts.some(k=>!nonnegative(sum[k]))||
    !nonnegative(sum.historical_train_or_holdout_changes)||
    sum.added+sum.modified+sum.unchanged!==720||
    report.requires_review!==(sum.added+sum.removed+sum.modified>0))
    fail();
  const bySeason=report.seasons.map((entry,i)=>{
    if(!entry||entry.season!==seasons[i]||
      counts.some(k=>!nonnegative(entry[k]))||
      entry.added+entry.modified+entry.unchanged!==240)
      fail();
    return {season:entry.season,...Object.fromEntries(counts.map(k=>[k,entry[k]]))};
  });
  for(const key of counts)
    if(bySeason.reduce((n,s)=>n+s[key],0)!==sum[key])fail();
  if(bySeason.slice(0,2).reduce((n,s)=>n+s.added+s.removed+s.modified,0)!==
    sum.historical_train_or_holdout_changes)fail();
  return {
    kind:'M1_PRIVATE_REVISION_PREVIEW',
    candidateRows:720,
    requiresReview:report.requires_review,
    autoUpdatesEnabled:false,
    historicalAsOfVerified:false,
    changeCounts:{...Object.fromEntries(counts.map(k=>[k,sum[k]])),
      historical_train_or_holdout_changes:sum.historical_train_or_holdout_changes},
    seasons:bySeason,
    publicWritesPerformed:0,
    rawProviderRecordsPrinted:0
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)fail();
    const fd=openSync(process.argv[2],constants.O_RDONLY|(constants.O_NOFOLLOW??0));
    let body;
    try{
      const stat=fstatSync(fd);
      if(!stat.isFile()||stat.size<2||stat.size>16384)fail();
      body=readFileSync(fd,'utf8');
    }finally{closeSync(fd);}
    process.stdout.write(JSON.stringify(summarizeRevisionPreview(JSON.parse(body)))+'\n');
  }catch{
    console.error('FAIL: private revision summary unavailable (no records logged)');
    process.exitCode=2;
  }
}
