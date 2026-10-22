const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'&&value.trim()?value.trim().slice(0,100):null;

/**
 * Browser-only bounded evidence for the openly published RPL league summary.
 * Intentionally does not return raw table rows or assume their source rights.
 */
export function summarizeFootbolno(payload){
  if(!plain(payload)||!Array.isArray(payload.standings)||
      payload.standings.length>100)throw new Error('Invalid Footbolno league summary');
  return {
    provider:'footbolno',
    count:payload.standings.length,
    updated:clean(payload.updated),
    examples:[],
  };
}

/**
 * Bounded display of an attributed SportScore preview: these are recent
 * WORLD football matches and do not establish RPL coverage.
 */
export function summarizeSportScore(payload){
  if(!plain(payload)||!Array.isArray(payload.matches)||
      payload.matches.length>10)throw new Error('Invalid SportScore matches response');
  const examples=payload.matches.slice(0,5).map(item=>{
    if(!plain(item))throw new Error('Unexpected match shape');
    return {
      home:clean(item.home),
      away:clean(item.away),
      status:clean(item.status),
    };
  });
  return {
    provider:'sportscore',
    count:payload.matches.length,
    updated:clean(payload.updated),
    examples,
  };
}

const SEASONS=['2024/2025','2025/2026','2026/2027'];
const csvRequired=['match_id','league_id','season','status','home_id','away_id','home_goals','away_goals'];
const csvMaximumRows=5000;
const csvMaximumColumns=48;
const legalStatuses=new Set(['finished','scheduled','live','cancelled']);

/**
 * A strict, bounded RFC4180-style CSV parser for publisher CSV.
 * No remote calls, persistent storage or reconstruction of third-party rows.
 */
export function parseBoundedCsv(csv){
  if(typeof csv!=='string'||csv.length===0||csv.length>2_000_000)
    throw new Error('CSV byte/character budget exceeded');
  const rows=[];let row=[],cell='',quoted=false,finishedQuote=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(quoted){
      if(ch==='"'){
        if(csv[i+1]==='"'){cell+='"';i++}
        else{quoted=false;finishedQuote=true}
      }else cell+=ch;
      if(cell.length>4096)throw new Error('CSV cell budget exceeded');
    }else if(ch==='"'){
      if(cell!==''||finishedQuote)throw new Error('Invalid CSV quote');
      quoted=true;
    }else if(ch===','||ch==='\n'||ch==='\r'){
      if(ch==='\r'&&csv[i+1]==='\n')i++;
      row.push(cell);cell='';finishedQuote=false;
      if(row.length>csvMaximumColumns)throw new Error('Excessive CSV columns');
      if(ch!==','){
        if(row.some(v=>v.length>0)){
          rows.push(row);
          if(rows.length>csvMaximumRows+1)throw new Error('CSV row budget exceeded');
        }
        row=[];
      }
    }else{
      if(finishedQuote)throw new Error('Unexpected text after closing quote');
      cell+=ch;
      if(cell.length>4096)throw new Error('CSV cell budget exceeded');
    }
  }
  if(quoted)throw new Error('Unclosed CSV quoted field');
  row.push(cell);
  if(row.some(v=>v.length>0))rows.push(row);
  if(rows.length>csvMaximumRows+1)throw new Error('CSV row budget exceeded');
  if(rows.length<2)throw new Error('CSV row budget invalid');
  const header=rows.shift().map((s,i)=>i===0?s.replace(/^\uFEFF/,''):s);
  if(new Set(header).size!==header.length)throw new Error('Duplicate CSV header');
  const keys=Object.fromEntries(header.map((s,i)=>[s,i]));
  if(csvRequired.some(k=>!Object.hasOwn(keys,k)))throw new Error('CSV fields missing');
  for(const row of rows)if(row.length!==header.length)throw new Error('Inconsistent CSV row width');
  return {header,rows,keys};
}

const score=s=>/^\d{1,2}$/.test(s)&&Number(s)<=20?Number(s):null;

export function summarizeFootbolnoRplCsv(csv){
  const {rows,keys,header}=parseBoundedCsv(csv);
  if(!header.includes('date_utc'))throw new Error('Missing kickoff date');
  const summaries=SEASONS.map(season=>({
    season,matches:0,finished:0,scheduled:0,live:0,cancelled:0,
    homeGoals:0,awayGoals:0,duplicates:0,duplicateMatchIds:0,
    missingTeams:0,invalidScores:0,
    structuralCandidate:false
  }));
  const found=new Map(summaries.map(s=>[s.season,s]));
  const pairs=new Map(SEASONS.map(s=>[s,new Set()]));
  const ids=new Map(SEASONS.map(s=>[s,new Set()]));
  for(const values of rows){
    const col=name=>values[keys[name]].trim();
    if(col('league_id')!=='235')continue;
    const season=col('season'),data=found.get(season);
    if(!data)continue;
    data.matches++;
    const status=col('status');
    if(!legalStatuses.has(status))throw new Error('Unknown league match status');
    data[status]++;
    const home=col('home_id'),away=col('away_id'),id=col('match_id');
    if(!home||!away||home===away)data.missingTeams++;
    if(!id)data.duplicateMatchIds++;
    else if(ids.get(season).has(id))data.duplicateMatchIds++;
    else ids.get(season).add(id);
    if(home&&away){
      const pair=home+'\0'+away;
      if(pairs.get(season).has(pair))data.duplicates++;
      else pairs.get(season).add(pair);
    }
    const gh=score(col('home_goals')),ga=score(col('away_goals'));
    if(status==='finished'){
      if(gh===null||ga===null)data.invalidScores++;
      else{data.homeGoals+=gh;data.awayGoals+=ga}
    }else if(status==='scheduled'&&(gh!==null||ga!==null))
      data.invalidScores++;
  }
  for(const s of summaries){
    // A structural candidate does NOT imply official accuracy, permissions or
    // authenticated timestamped revision history for a model.
    s.structuralCandidate=s.matches===240&&s.duplicates===0&&
      s.duplicateMatchIds===0&&s.missingTeams===0&&s.invalidScores===0&&
      s.matches===s.finished+s.scheduled+s.live+s.cancelled&&
      (s.season==='2026/2027'||s.finished===240);
  }
  return {
    provider:'footbolno',checkedScope:'rpl-three-seasons',
    publisherRows:rows.length,seasonSummaries:summaries,
    recordRevisionTimestampsAvailable:false,
    originalMatchRightsVerified:false,
    sourceMatchAccuracyVerified:false,
    modelTrainingApproved:false
  };
}
