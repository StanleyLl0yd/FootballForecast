// M1 server-only PostgreSQL loader. No web routes, no public credentials, no logs of rows.
import {createHash} from 'node:crypto';
import {openSync,readFileSync,closeSync,fstatSync,constants} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {SOURCE_URL,ATTRIBUTION_URL,SEASON_ROLES} from './m1-footbolno-normalize.mjs';

const SEASONS=Object.keys(SEASON_ROLES);
const sha=s=>createHash('sha256').update(s).digest('hex');
const hash64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const refuse=s=>{throw Error('Private stage refused: '+s);};
const utc=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(s)&&
  Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString().slice(0,19)===s.slice(0,19);
const day=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const id=s=>typeof s==='string'&&/^[\p{L}\p{N}._:-]{1,100}$/u.test(s);
const name=s=>typeof s==='string'&&s.length>0&&s.length<=120&&!/[\u0000-\u001f]/.test(s);
const goal=g=>Number.isInteger(g)&&g>=0&&g<=20;
function readSafe(path,max){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>max)refuse('file size or type');
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
export function validateStageDataset(manifest,seasonFiles){
  if(!manifest||manifest.kind!=='M1_PRIVATE_RPL_DATASET'||manifest.schemaVersion!==1||
    manifest.source!=='Footbolno'||manifest.sourceUrl!==SOURCE_URL||
    manifest.license!=='CC BY 4.0'||manifest.licenseUrl!==ATTRIBUTION_URL||
    !hash64(manifest.sourceFileSha256)||!utc(manifest.retrievedAtUtc)||
    Date.parse(manifest.retrievedAtUtc)>Date.now()+30000||
    manifest.historicalPrematchPublicationVerified!==false||
    manifest.strictHistoricalBacktestingAllowed!==false||
    manifest.modelTrained!==false||manifest.dbImported!==false)
    refuse('source license, provenance or as-of manifest');
  if(!seasonFiles||Object.keys(seasonFiles).length!==3)refuse('need exactly three seasons');
  const normalized=[];
  for(const season of SEASONS){
    const body=seasonFiles[season],q=manifest.quality?.[season];
    if(typeof body!=='string'||Buffer.byteLength(body)>700000||
      !body.endsWith('\n')||!hash64(manifest.snapshotSHA256?.[season])||
      sha(Buffer.from(body,'utf8'))!==manifest.snapshotSHA256[season]||
      q?.role!==SEASON_ROLES[season]||q?.ready!==true||
      q?.rows!==240||q?.teams!==16||q?.directedPairs!==240||
      q?.quarantined!==0||(season!=='2026/2027'&&q.finished!==240))
      refuse('season source hash or quality gate');
    const lines=body.trimEnd().split('\n'),ids=new Set(),pairs=new Set(),clubs=new Set();
    if(lines.length!==240)refuse('season row count');
    for(const line of lines){
      let r;
      try{r=JSON.parse(line);}catch{refuse('invalid JSONL');}
      if(!r||r.source!=='footbolno'||r.competition!=='RPL'||
        r.season!==season||r.role!==SEASON_ROLES[season]||
        !id(r.sourceMatchId)||!id(r.homeTeamId)||!id(r.awayTeamId)||
        r.homeTeamId===r.awayTeamId||!name(r.homeTeam)||!name(r.awayTeam)||
        r.sourceFileSha256!==manifest.sourceFileSha256||
        r.quarantineReason!==null||r.publishedAtUtc!==null||
        typeof r.kickoffTimeConfirmed!=='boolean'||
        (r.kickoffUtc===null)!==!r.kickoffTimeConfirmed||
        (r.kickoffUtc!==null&&!utc(r.kickoffUtc))||!day(r.calendarDateUtc)||
        !['finished','scheduled','live','cancelled','postponed','awarded'].includes(r.status))
        refuse('untrusted or quarantined source record');
      const [a,b]=season.split('/').map(Number);
      if(r.calendarDateUtc<a+'-07-01'||r.calendarDateUtc>=b+'-07-01')
        refuse('date outside source season');
      if(r.status==='finished'){
        if(!goal(r.homeGoals)||!goal(r.awayGoals))refuse('invalid finished score');
      }else if(r.homeGoals!==null||r.awayGoals!==null)
        refuse('nonfinal goals not permitted');
      const pair=JSON.stringify([r.homeTeamId,r.awayTeamId]);
      if(ids.has(r.sourceMatchId)||pairs.has(pair))refuse('duplicate source fixture');
      ids.add(r.sourceMatchId);pairs.add(pair);
      clubs.add(r.homeTeamId);clubs.add(r.awayTeamId);
      normalized.push({
        external_id:r.sourceMatchId,season:r.season,role:r.role,
        home_id:r.homeTeamId,away_id:r.awayTeamId,
        home:r.homeTeam,away:r.awayTeam,day:r.calendarDateUtc,
        kickoff:r.kickoffUtc,confirmed:r.kickoffTimeConfirmed,
        status:r.status,home_goals:r.homeGoals,away_goals:r.awayGoals
      });
    }
    if(clubs.size!==16||pairs.size!==240)refuse('directed fixtures or teams incomplete');
  }
  return {manifest,records:normalized};
}
export function buildStageSql(dataset){
  if(dataset?.records?.length!==720||!hash64(dataset.manifest?.sourceFileSha256)||
    !utc(dataset.manifest?.retrievedAtUtc))refuse('database batch contract');
  const hash=dataset.manifest.sourceFileSha256;
  const retrieval=dataset.manifest.retrievedAtUtc;
  const hashes=JSON.stringify(Object.fromEntries(SEASONS.map(s=>[s,dataset.manifest.snapshotSHA256[s]])));
  if(SEASONS.some(s=>!hash64(dataset.manifest.snapshotSHA256[s])))refuse('normalized hashes missing');
  // Base64 encoding makes provider contents literal data, not SQL syntax.
  const payload=Buffer.from(JSON.stringify(dataset.records),'utf8').toString('base64');
  return [
    'begin;', "set local statement_timeout = '45s';",
    "set local lock_timeout = '5s';",
    "select pg_advisory_xact_lock(hashtext('footballforecast-m1-footbolno'));",
    'do $ff_m1$', 'declare src uuid; snap uuid; n integer; payload jsonb;',
    'begin',
    "insert into public.ff_sources(name,license_status,license_reference,approved_at)",
    "values('Footbolno','approved','"+ATTRIBUTION_URL+"',clock_timestamp())",
    'on conflict (name) do nothing;',
    "select id into strict src from public.ff_sources where name='Footbolno'",
    "and license_status='approved' and license_reference='"+ATTRIBUTION_URL+"';",
    'insert into ff_private.ff_ingest_snapshots',
    '(source_id,source_url,license_url,source_sha256,normalized_sha256,retrieved_at)',
    "values(src,'"+SOURCE_URL+"','"+ATTRIBUTION_URL+"','"+hash+"','"+hashes+"'::jsonb,'"+retrieval+"'::timestamptz)",
    'on conflict (source_id,source_sha256) do nothing;',
    "select id into strict snap from ff_private.ff_ingest_snapshots where source_id=src",
    "and source_sha256='"+hash+"'",
    "and normalized_sha256='"+hashes+"'::jsonb;",
    'select count(*) into n from ff_private.ff_ingest_matches where snapshot_id=snap;',
    "if n not in (0,720) then raise exception 'Partial source snapshot'; end if;",
    'if n=0 then',
    "payload:=convert_from(decode('"+payload+"','base64'),'UTF8')::jsonb;",
    'insert into ff_private.ff_ingest_matches',
    '(snapshot_id,source_match_id,season,dataset_role,home_source_id,away_source_id,',
    'home_name,away_name,calendar_date_utc,kickoff_at,kickoff_time_confirmed,',
    'status,home_goals,away_goals,quarantine_reason,published_at)',
    'select snap,r.external_id,r.season,r.role,r.home_id,r.away_id,',
    'r.home,r.away,r.day::date,r.kickoff::timestamptz,r.confirmed,',
    'r.status,r.home_goals,r.away_goals,null,null',
    'from jsonb_to_recordset(payload) as r(',
    'external_id text,season text,role text,home_id text,away_id text,',
    'home text,away text,day text,kickoff text,confirmed boolean,',
    'status text,home_goals integer,away_goals integer);',
    'end if;',
    "if (select count(*) from ff_private.ff_ingest_matches where snapshot_id=snap)<>720",
    'or (select count(distinct season) from ff_private.ff_ingest_matches where snapshot_id=snap)<>3',
    'or exists(select 1 from ff_private.ff_ingest_matches',
    'where snapshot_id=snap group by season having count(*)<>240)',
    "then raise exception 'Source snapshot integrity mismatch'; end if;",
    'end;', '$ff_m1$;', 'commit;'
  ].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==6&&process.argv.length!==7)
      refuse('MANIFEST 2024_JSONL 2025_JSONL 2026_JSONL [--commit]');
    const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const manifest=JSON.parse(text(readSafe(process.argv[2],65536)));
    const files=Object.fromEntries(SEASONS.map((s,i)=>
      [s,text(readSafe(process.argv[i+3],700000))]));
    const dataset=validateStageDataset(manifest,files);
    const committing=process.argv[6]==='--commit';
    if(process.argv.length===7&&!committing)refuse('invalid operation');
    if(committing){
      const env=process.env;
      if(env.FF_M1_DB_WRITE_ENABLED!=='1'||!env.PGHOST||!env.PGUSER||
        !env.PGDATABASE||!env.PGPASSWORD||
        (env.PGSSLMODE!=='verify-full'&&
          !(env.PGSSLMODE==='disable'&&
            ['localhost','127.0.0.1'].includes(env.PGHOST))))
        refuse('privileged database prerequisites absent');
      const result=spawnSync('psql',['-X','-q','-v','ON_ERROR_STOP=1'],
        {input:buildStageSql(dataset),encoding:'utf8',timeout:55000,
          maxBuffer:131072,stdio:['pipe','pipe','pipe']});
      // Raw PostgreSQL errors might include query text. Never log them.
      if(result.error||result.status!==0)refuse('atomic transaction failed');
    }
    console.log(JSON.stringify({
      kind:'M1_PRIVATE_STAGE',rows:720,sourceSha256:manifest.sourceFileSha256,
      retrievedAtUtc:manifest.retrievedAtUtc,writeCommitted:committing,
      publicMatchesPromoted:0,strictHistoricalBacktest:false
    }));
  }catch{
    console.error('FAIL: private stage refused without logging provider records');
    process.exitCode=2;
  }
}
