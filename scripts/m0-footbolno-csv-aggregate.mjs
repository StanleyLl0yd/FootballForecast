// M0: ONE-SHOT, LOCAL-ONLY, bounded structural inspection of a publisher-advertised
// free RPL CSV. It does NOT license the data, prove official scores, ingest records,
// train a model or retain/upload any original row. No HTTP/network in this module.
import {createHash} from 'node:crypto';
import {openSync,readFileSync,fstatSync,closeSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const publisherCsv='https://footbolno.ru/data/league/235-matches.csv';
const MAX_BYTES=2*1024*1024,MAX_ROWS=15000,MAX_COLS=64,MAX_CELL=4096;
const required=['match_id','league_id','season','status','home_id','away_id','home_goals','away_goals'];
const statuses=new Set(['finished','scheduled','live','cancelled']);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=s=>{throw new Error('Unapproved CSV inspection refused: '+s)};

// Quoted RFC4180-compatible CSV incl. BOM, commas, doubled quotes, LF and CRLF.
// No provider row text is emitted in a diagnostic or thrown error.
function parseCsv(text){
  if(text.charCodeAt(0)===0xfeff)text=text.slice(1);
  if(text.includes('\0'))fail('NUL in source');
  const rows=[];let record=[],field='',quoted=false,closed=false,start=true;
  function endField(){
    if(field.length>MAX_CELL)fail('oversized cell');
    record.push(field);
    if(record.length>MAX_COLS)fail('too many columns');
    field='';closed=false;start=true;
  }
  function endRow(){
    endField();
    if(record.length===1&&record[0]==='')fail('blank row');
    rows.push(record);record=[];
    if(rows.length>MAX_ROWS+1)fail('too many rows');
  }
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'){
        if(text[i+1]==='"'){field+='"';i++}
        else{quoted=false;closed=true}
      }else field+=c;
    }else if(closed){
      if(c===',')endField();
      else if(c==='\n')endRow();
      else if(c==='\r'&&text[i+1]==='\n'){endRow();i++}
      else fail('unexpected character after quote');
    }else if(c==='"'){
      if(!start)fail('quote inside unquoted field');
      quoted=true;start=false;
    }else if(c===',')endField();
    else if(c==='\n')endRow();
    else if(c==='\r'&&text[i+1]==='\n'){endRow();i++}
    else if(c==='\r')fail('bare carriage return');
    else{field+=c;start=false}
    if(field.length>MAX_CELL)fail('oversized cell');
  }
  if(quoted)fail('unterminated quoted field');
  if(record.length||field.length||closed||!start)endRow();
  if(rows.length<2)fail('requires header and records');
  const [header,...records]=rows;
  if(new Set(header).size!==header.length)fail('duplicate header');
  for(const column of required)if(!header.includes(column))fail('required column missing: '+column);
  if(records.some(r=>r.length!==header.length))fail('row width mismatch');
  return {header,records};
}

function validSeason(value){
  const m=typeof value==='string'&&value.match(/^(20\d{2})\/(20\d{2})$/);
  return m!==false&&m!==null&&Number(m[2])===Number(m[1])+1;
}
function summary(){
  return {rows:0,finished:0,scheduled:0,live:0,cancelled:0,
    invalidScores:0,duplicateMatchIds:0,duplicateOrderedPairs:0,
    missingClubIds:0,distinctClubIds:new Set(),directedPairs:new Set(),
    matchIds:new Set(),scoreTotals:{home:0,away:0}};
}
export function inspectFreeRplCsv(bytes,expectedHash){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>MAX_BYTES)
    fail('file size outside safe bounds');
  if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/.test(expectedHash))
    fail('missing exact 64-digit hash pin');
  const actual=sha256(bytes);
  if(actual!==expectedHash)fail('hash pin mismatch');
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  catch{fail('invalid UTF-8')}
  const {header,records}=parseCsv(text);
  const col=Object.fromEntries(header.map((name,i)=>[name,i]));
  const seasons=new Map();
  let unknownSeasonRows=0,unknownStatusRows=0,invalidLeagueRows=0;
  for(const row of records){
    const read=name=>row[col[name]];
    if(read('league_id')!=='235'){invalidLeagueRows++;continue}
    const season=read('season');
    if(!validSeason(season)){unknownSeasonRows++;continue}
    if(!seasons.has(season))seasons.set(season,summary());
    const s=seasons.get(season);
    s.rows++;
    const id=read('match_id');
    if(!id||s.matchIds.has(id))s.duplicateMatchIds++;
    else s.matchIds.add(id);
    const h=read('home_id'),a=read('away_id');
    if(!h||!a||h===a)s.missingClubIds++;
    else{
      s.distinctClubIds.add(h);s.distinctClubIds.add(a);
      const key=JSON.stringify([h,a]);
      if(s.directedPairs.has(key))s.duplicateOrderedPairs++;
      s.directedPairs.add(key);
    }
    const status=read('status');
    if(!statuses.has(status)){unknownStatusRows++;continue}
    s[status]++;
    if(status==='finished'){
      const hGoals=read('home_goals'),aGoals=read('away_goals');
      if(!/^(?:0|[1-9]\d?)$/.test(hGoals)||!/^(?:0|[1-9]\d?)$/.test(aGoals)||
        Number(hGoals)>30||Number(aGoals)>30)s.invalidScores++;
      else{
        // Not verified on-field goals: a source score might be awarded.
        s.scoreTotals.home+=Number(hGoals);s.scoreTotals.away+=Number(aGoals);
      }
    }
  }
  if(seasons.size>30)fail('implausible season count');
  const seasonStats=[...seasons].sort(([a],[b])=>a.localeCompare(b))
    .map(([season,s])=>({
      season,sourceRows:s.rows,
      statuses:{finished:s.finished,scheduled:s.scheduled,live:s.live,cancelled:s.cancelled},
      distinctClubCount:s.distinctClubIds.size,
      distinctDirectedPairs:s.directedPairs.size,
      duplicateMatchIds:s.duplicateMatchIds,
      duplicateDirectedPairs:s.duplicateOrderedPairs,
      missingClubIds:s.missingClubIds,invalidFinishedScores:s.invalidScores,
      sourceReportedScoreTotalsNotVerifiedOnField:s.scoreTotals,
      complete240GameRplSeasonNOTEstablished:true
    }));
  return {
    schemaVersion:1,kind:'M0_EPHEMERAL_UNAPPROVED_SOURCE_CANDIDATE',
    sourceUrl:publisherCsv,sourceFileSHA256:actual,sourceBytes:bytes.byteLength,
    csvRecordCount:records.length,csvColumnCount:header.length,
    hasPublishedAtColumn:['published_at','publishedAt','created_at'].some(k=>header.includes(k)),
    hasUpdatedAtColumn:['updated_at','updatedAt'].some(k=>header.includes(k)),
    invalidLeagueRows,unknownSeasonRows,unknownStatusRows,seasonStats,
    active:false,licensedForTraining:false,licensedForRedistribution:false,
    historicalPrematchSnapshotsVerified:false,officialMatchAccuracyMeasured:false,
    rowsSavedInGitOrSupabase:false,
    warning:'Publisher-advertised $0 CSV examined only transiently: records NOT approved for commercial/training/redistribution; upstream license, true on-field scores, data accuracy and pre-match availability UNVERIFIED.'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){
    console.error('Usage: node scripts/m0-footbolno-csv-aggregate.mjs TEMP_CSV_FILE SHA256');
    process.exitCode=2;
  }else{
    try{
      const fd=openSync(process.argv[2],constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      let bytes;
      try{
        const stat=fstatSync(fd);
        if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)fail('not a bounded regular file');
        bytes=readFileSync(fd);
      }finally{closeSync(fd)}
      console.log(JSON.stringify(inspectFreeRplCsv(bytes,process.argv[3]),null,2));
    }catch(error){
      console.error('FAIL: '+error.message);
      process.exitCode=2;
    }
  }
}
