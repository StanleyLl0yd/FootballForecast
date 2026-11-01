// Aggregate-only rejection diagnostics; never print provider rows or parser errors.
import {openSync,readFileSync,closeSync,fstatSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';

const PREFIX='M1_SOURCE_QUALITY_REJECTED';
const KEYS=Object.freeze([
  'quarantined','staleScheduled','live','cancelled','postponed','awarded',
  'futureFinished','invalidDates','invalidScores','unconfirmedFinished'
]);
const safeCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=240?n:null;
export function formatFootbolnoQualityFailure(report){
  const q=report?.kind==='M1_PRIVATE_RPL_DATASET'
    ? report?.quality?.['2026/2027'] : null;
  if(!q||typeof q!=='object'||Array.isArray(q))
    return PREFIX+': aggregate quality report unavailable';
  return PREFIX+' '+JSON.stringify({
    currentSeasonReady:q.ready===true,
    currentSeasonStructural:q.structural===true,
    currentSeasonRows:safeCount(q.rows),
    currentSeason:Object.fromEntries(KEYS.map(k=>[k,safeCount(q[k])]))
  });
}
function safeRead(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const s=fstatSync(fd);
    if(!s.isFile()||s.size<2||s.size>32768)
      throw Error('Invalid bounded quality report');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(fd)));
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let output=PREFIX+': aggregate quality report unavailable';
  if(process.argv.length===3){
    try{output=formatFootbolnoQualityFailure(safeRead(process.argv[2]));}
    catch{/* No upstream content or error text is safe to disclose. */}
  }
  console.error(output);
}
