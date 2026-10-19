// M0 offline, independent candidate reconciliation. No downloads, DB access or source approval.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {auditFootballTxtQuality} from './m0-source-quality.mjs';

const fixture=/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s{2,}v\s+(.+?)\s{2,}(\d+)-(\d+)(.*)$/;
const dateLine=/^\s{2}(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s+(\d{4}))?\s*$/;
const months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const weekdays='Sun Mon Tue Wed Thu Fri Sat'.split(' ');
const isoPattern=/^\d{4}-\d{2}-\d{2}$/;
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
const pair=(home,away)=>JSON.stringify([home,away]);
const validGoals=n=>Number.isSafeInteger(n)&&n>=0&&n<=99;

function validISO(value){
  if(typeof value!=='string'||!isoPattern.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function sourceRows(source){
  let year=null,date=null,round=null;
  const rows=[],dateErrors=[];
  source.split(/\r?\n/).forEach((line,index)=>{
    const lineNumber=index+1;
    if(/^\s*▪\s*Matchday\s+\d+\s*$/.test(line)){round=Number(line.match(/\d+\s*$/)[0]);date=null;return;}
    const d=line.match(dateLine);
    if(d){
      if(d[4])year=Number(d[4]);
      const month=months.indexOf(d[2])+1;
      const candidate=year===null?null:[year,String(month).padStart(2,'0'),d[3].padStart(2,'0')].join('-');
      if(!candidate||!validISO(candidate)||weekdays[new Date(candidate+'T00:00:00Z').getUTCDay()]!==d[1]){
        dateErrors.push({line:lineNumber,reason:'invalid or unanchored match date'});
        date=null;
      }else date=candidate;
      return;
    }
    if(!/\s+v\s+/.test(line))return;
    const match=line.match(fixture);
    if(!match)return; // Structural auditor reports malformed fixtures.
    const tail=match[5].trim().replace(/^\(\d+-\d+\)(?=\s|$)\s*/,'').trim();
    if(!date)dateErrors.push({line:lineNumber,reason:'fixture without validated calendar date'});
    rows.push({home:match[1].trim(),away:match[2].trim(),
      homeGoals:Number(match[3]),awayGoals:Number(match[4]),
      resultType:tail==='[awarded]'?'awarded':'played',date,round,line:lineNumber});
  });
  return {rows,dateErrors};
}

export function reconcileFootballTxt(source,referenceJsonl,options={}){
  if(typeof source!=='string'||typeof referenceJsonl!=='string')
    throw new TypeError('Both sources must be UTF-8 text');
  const quality=auditFootballTxtQuality(source,options);
  const primary=sourceRows(source);
  const reference=[],referenceErrors=[],seen=new Set();
  referenceJsonl.split(/\r?\n/).forEach((line,index)=>{
    if(!line.trim())return;
    const lineNumber=index+1;
    let item;
    try{item=JSON.parse(line);}catch{
      referenceErrors.push({line:lineNumber,reason:'invalid JSON'});return;
    }
    if(!item||typeof item!=='object'||Array.isArray(item)||
       typeof item.home!=='string'||!item.home.trim()||
       typeof item.away!=='string'||!item.away.trim()||item.home===item.away||
       item.home!==item.home.trim()||item.away!==item.away.trim()||
       !validGoals(item.homeGoals)||!validGoals(item.awayGoals)||
       !validISO(item.date)||!['played','awarded'].includes(item.resultType)){
      referenceErrors.push({line:lineNumber,reason:'invalid canonical fixture fields'});return;
    }
    const key=pair(item.home,item.away);
    if(seen.has(key)){
      referenceErrors.push({line:lineNumber,reason:'duplicate ordered reference fixture'});return;
    }
    seen.add(key);
    reference.push({home:item.home,away:item.away,homeGoals:item.homeGoals,
      awayGoals:item.awayGoals,date:item.date,resultType:item.resultType,line:lineNumber});
  });
  const referenceByPair=new Map(reference.map(x=>[pair(x.home,x.away),x]));
  const primaryKeys=new Set(primary.rows.map(x=>pair(x.home,x.away)));
  const missingFromReference=[],missingFromPrimary=[],mismatches=[];
  for(const row of primary.rows){
    const ref=referenceByPair.get(pair(row.home,row.away));
    if(!ref){
      missingFromReference.push({line:row.line,home:row.home,away:row.away});continue;
    }
    const differing=['date','homeGoals','awayGoals','resultType'].filter(k=>row[k]!==ref[k]);
    if(differing.length)mismatches.push({home:row.home,away:row.away,
      primaryLine:row.line,referenceLine:ref.line,fields:differing});
  }
  for(const ref of reference){
    if(!primaryKeys.has(pair(ref.home,ref.away)))
      missingFromPrimary.push({line:ref.line,home:ref.home,away:ref.away});
  }
  const expectedMatches=options.expectedMatches??240;
  if(reference.length!==expectedMatches)
    referenceErrors.push({reason:'reference match count differs from expected'});
  return {
    // Neither a passing comparison nor the recorded SHA-256 establishes independent provenance.
    retrospectiveOnly:true,sourceApproval:false,independenceVerified:false,
    primarySHA256:digest(source),referenceSHA256:digest(referenceJsonl),
    qualityPassed:quality.mechanicalChecksPassed,primaryCount:primary.rows.length,
    referenceCount:reference.length,awardedCount:quality.awardedCount,
    dateErrors:primary.dateErrors,referenceErrors,missingFromReference,
    missingFromPrimary,mismatches,
    comparisonPassed:quality.mechanicalChecksPassed&&primary.dateErrors.length===0&&
      referenceErrors.length===0&&missingFromReference.length===0&&
      missingFromPrimary.length===0&&mismatches.length===0,
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){
    console.error('Usage: node scripts/m0-fixture-reconcile.mjs LOCAL_FOOTBALL_TXT LOCAL_REFERENCE_JSONL');
    process.exitCode=2;
  }else{
    try{
      const result=reconcileFootballTxt(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8'));
      console.log(JSON.stringify(result,null,2));
      if(!result.comparisonPassed)process.exitCode=1;
    }catch(error){
      console.error(error.message);process.exitCode=2;
    }
  }
}
