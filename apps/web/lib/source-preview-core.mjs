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

// Source date_utc is UTC, even when the publisher supplied only a calendar day.
// Never invent a kickoff time for time_confirmed=0.
function parsePublisherUtc(raw){
  const text=raw.trim().replace(' ','T');
  const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(text);
  const withTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z|\+00:00|\+0000)?$/.test(text);
  if(!dateOnly&&!withTime)return null;
  const zoneSupplied=/(?:Z|\+00:00|\+0000)$/.test(text);
  const iso=dateOnly?text+'T00:00:00Z':
    zoneSupplied?text:text+'Z';
  const epoch=Date.parse(iso);
  if(!Number.isFinite(epoch))return null;
  const dateUtc=new Date(epoch).toISOString();
  if(dateUtc.slice(0,10)!==text.slice(0,10))return null;
  return {epoch,dateUtc,dateOnly};
}

export function summarizeFootbolnoRplCsv(csv,nowIsoUtc=new Date().toISOString()){
  const {rows,keys,header}=parseBoundedCsv(csv);
  if(['date_utc','home','away','time_confirmed'].some(k=>!header.includes(k)))
    throw new Error('Missing required fixture fields');
  const now=Date.parse(nowIsoUtc);
  if(!Number.isFinite(now))throw new Error('Invalid audit timestamp');
  const todayUtc=new Date(now).toISOString().slice(0,10);
  const upcoming=[];
  const upcomingSeen=new Set();
  const summaries=SEASONS.map(season=>({
    season,matches:0,finished:0,scheduled:0,live:0,cancelled:0,
    homeGoals:0,awayGoals:0,duplicates:0,duplicateMatchIds:0,
    missingTeams:0,invalidScores:0,
    invalidDates:0,invalidTimeFlags:0,pastScheduled:0,
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
    const date=parsePublisherUtc(col('date_utc'));
    // RPL pilot seasons are July-to-June. A valid ISO date outside its
    // recorded season is a hard chronology inconsistency.
    const lower=season.slice(0,4)+'-07-01';
    const upper=season.slice(5)+'-07-01';
    const inside=date&&date.dateUtc.slice(0,10)>=lower&&
      date.dateUtc.slice(0,10)<upper;
    if(!inside)data.invalidDates++;
    const flag=col('time_confirmed');
    if(!['0','1'].includes(flag)||(flag==='1'&&date?.dateOnly))
      data.invalidTimeFlags++;
    if(season==='2026/2027'&&status==='scheduled'&&inside&&
      (flag==='1'&&!date.dateOnly?date.epoch<now:
        date.dateUtc.slice(0,10)<todayUtc))
      data.pastScheduled++;
    const gh=score(col('home_goals')),ga=score(col('away_goals'));
    if(status==='finished'){
      if(gh===null||ga===null)data.invalidScores++;
      else{data.homeGoals+=gh;data.awayGoals+=ga}
    }else if(status==='scheduled'&&(gh!==null||ga!==null))
      data.invalidScores++;
    if(season==='2026/2027'&&status==='scheduled'){
      const kickoff=inside?date:null;
      const timeConfirmed=flag==='1';
      const future=kickoff&&(
        timeConfirmed&&!kickoff.dateOnly?kickoff.epoch>=now:
        kickoff.dateUtc.slice(0,10)>=todayUtc
      );
      const homeName=col('home').slice(0,80),awayName=col('away').slice(0,80);
      const pair=home+'|'+away;
      if(future&&homeName&&awayName&&home&&away&&
        !upcomingSeen.has(pair)){
        upcomingSeen.add(pair);
        upcoming.push({
          home:homeName,away:awayName,kickoffUtc:kickoff.dateUtc,
          timeConfirmed:timeConfirmed&&!kickoff.dateOnly
        });
      }
    }
  }
  upcoming.sort((a,b)=>a.kickoffUtc.localeCompare(b.kickoffUtc)||
    a.home.localeCompare(b.home));
  for(const s of summaries){
    // A structural candidate does NOT imply official accuracy, permissions or
    // authenticated timestamped revision history for a model.
    s.structuralCandidate=s.matches===240&&s.duplicates===0&&
      s.duplicateMatchIds===0&&s.missingTeams===0&&s.invalidScores===0&&
      s.invalidDates===0&&s.invalidTimeFlags===0&&s.pastScheduled===0&&
      s.matches===s.finished+s.scheduled+s.live+s.cancelled&&
      (s.season==='2026/2027'||s.finished===240);
  }
  return {
    provider:'footbolno',checkedScope:'rpl-three-seasons',
    publisherRows:rows.length,seasonSummaries:summaries,
    // At most eight scheduled RPL 2026/27 items shown from the same CSV GET.
    // Not a verified official kickoff / current provider SLA.
    upcomingFixtures:upcoming.slice(0,8),
    recordRevisionTimestampsAvailable:false,
    originalMatchRightsVerified:false,
    sourceMatchAccuracyVerified:false,
    modelTrainingApproved:false
  };
}
