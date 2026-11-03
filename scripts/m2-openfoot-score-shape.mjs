// Private bounded first-page score-shape observation; no match score values ever leave runner.
import {createHash} from 'node:crypto';
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
const fail=()=>{throw Error('M2 score-shape observation refused untrusted response');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const isGoal=x=>Number.isSafeInteger(x)&&x>=0&&x<=20;
const fields=Object.freeze({
  topLevelGoals:r=>[r.homeGoals,r.awayGoals],
  scoreHomeAway:r=>[r.score?.home,r.score?.away],
  scoreHomeGoalsAwayGoals:r=>[r.score?.homeGoals,r.score?.awayGoals],
  scoreHomeScoreAwayScore:r=>[r.score?.homeScore,r.score?.awayScore],
  scoreFullTimeHomeAway:r=>[r.score?.fullTime?.home,r.score?.fullTime?.away],
  scoreFullTimeHomeGoalsAwayGoals:r=>[r.score?.fullTime?.homeGoals,r.score?.fullTime?.awayGoals],
  scoreFullTimeHomeTeamAwayTeam:r=>[r.score?.fullTime?.homeTeam,r.score?.fullTime?.awayTeam],
  fullTimeHomeAway:r=>[r.fullTime?.home,r.fullTime?.away],
  resultHomeAway:r=>[r.result?.home,r.result?.away]
});
export function auditScoreShape(doc,observedAtUtc){
  if(!obj(doc)||!Array.isArray(doc.data)||doc.data.length===0||doc.data.length>50||
     !obj(doc.meta)||!obj(doc.meta.access)||
     doc.meta.access.authenticated!==true||doc.meta.access.plan!=='starter'||
     doc.meta.count!==doc.data.length||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(observedAtUtc)||
     Number.isNaN(Date.parse(observedAtUtc)))fail();
  const counts=Object.fromEntries(Object.keys(fields).map(k=>[k,0]));
  const ids=new Set();let finished=0,scoreObjects=0,scoreNull=0;
  for(const r of doc.data){
    if(!obj(r)||typeof r.id!=='string'||r.id.length>160||r.id.length<2||
       ids.has(r.id)||r.competitionId!=='comp_premier_league_rus'||
       r.season!=='2018/19'||!obj(r.homeTeam)||!obj(r.awayTeam)||
       typeof r.homeTeam.id!=='string'||typeof r.awayTeam.id!=='string'||
       r.homeTeam.id===r.awayTeam.id||
       !['finished','postponed','cancelled','unknown','scheduled','live'].includes(r.status))fail();
    ids.add(r.id);
    if(r.status==='finished')finished++;
    if(obj(r.score))scoreObjects++;
    if(r.score==null)scoreNull++;
    for(const [name,get] of Object.entries(fields)){
      const pair=get(r);
      if(isGoal(pair[0])&&isGoal(pair[1]))counts[name]++;
    }
  }
  return Object.freeze({
    schemaVersion:1,kind:'M2_OPENFOOT_RPL_SCORE_SCHEMA_SAMPLE',
    observedAtUtc,season:'2018/19',sampleRows:ids.size,finished,
    scoreObjectRows:scoreObjects,scoreNullRows:scoreNull,
    numericGoalPairCandidates:counts,
    exactFinalScoreSchemaVerified:false,
    modelTrainingApproved:false,holdoutRead:false,providerRowsLogged:0
  });
}
function readBounded(path){
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size<2||stat.size>200000)fail();
    return readFileSync(fd);
  }finally{closeSync(fd);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==4)fail();
    const raw=readBounded(process.argv[2]);
    const doc=JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(raw));
    const result=auditScoreShape(doc,process.argv[3]);
    console.log(JSON.stringify({...result,responseSha256:createHash('sha256').update(raw).digest('hex')}));
  }catch{
    console.error('M2 RPL score-shape research inconclusive; no match records emitted');
    process.exitCode=2;
  }
}
