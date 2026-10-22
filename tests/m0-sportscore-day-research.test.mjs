import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {compareSportScoreDay,runDayProbe} from '../scripts/m0-sportscore-day-research.mjs';

const clubs=[
  'Akhmat Grozny','Akron Tolyatti','Baltika Kaliningrad','CSKA Moscow',
  'Dynamo Makhachkala','Dynamo Moscow','Fakel Voronezh','Krasnodar',
  'Krylia Sovetov','Lokomotiv Moscow','Orenburg','Rodina Moscow',
  'Rostov','Rubin Kazan','Spartak Moscow','Zenit St Petersburg'
];
const days=['2026-10-17','2026-10-18','2026-10-19',
  '2026-10-23','2026-10-24','2026-10-25'];
function makeCsv(){
  const header='match_id,league_id,season,status,home_id,away_id,home_goals,away_goals,date_utc,time_confirmed,home,away';
  const rows=[header];let n=0;
  for(let i=0;i<16;i++)for(let j=0;j<16;j++){
    if(i===j)continue;
    n++;
    let date='2026-11-01',status='scheduled';
    if(n===1){date='2026-10-18';status='finished'}
    if(n===2){date='2026-10-23';status='scheduled'}
    rows.push([n,'235','2026/2027',status,i+1,j+1,
      status==='finished'?'2':'',status==='finished'?'1':'',
      date+'T12:00:00Z','1',clubs[i],clubs[j]].join(','));
  }
  return rows.join('\n')+'\n';
}
const csv=makeCsv();
const match={
  competition:{name:'Russian Premier League'},
  home:'Akhmat Grozny',away:'Akron Tolyatti',
  home_score:2,away_score:1,status:'finished'
};
test('a genuinely labeled 2026 RPL match has visible paired aggregate, not raw rows',()=>{
  const out=compareSportScoreDay(csv,'2026-10-18',{
    fixtures:[match,{competition:'English Premier League',home:'Liverpool',away:'Arsenal'}]
  });
  assert.equal(out.apiSchemaRecognized,true);
  assert.equal(out.footbolnoFixtures,1);
  assert.equal(out.sportscoreReturnedFixtures,2);
  assert.equal(out.rplExplicitlyLabeled,1);
  assert.equal(out.candidateClubMatches,1);
  assert.equal(out.pairsMatchingSource,1);
  assert.equal(out.differentFinishedScores,0);
  assert.equal(out.scheduleCoverageVerified,false);
  assert.equal(out.matchTruthVerified,false);
  assert.doesNotMatch(JSON.stringify(out),/Akhmat|Akron|Liverpool|home_score/);
});
test('day result mismatches count but never assert official truth or licensing',()=>{
  const out=compareSportScoreDay(csv,'2026-10-18',{
    data:{fixtures:[{...match,home_score:3}]}
  });
  assert.equal(out.differentFinishedScores,1);
  assert.equal(out.matchTruthVerified,false);
});
test('explicit Russian-language league and nested team scores are accepted; wrong date is not',()=>{
  const russian={competition:'РПЛ',home:{name:'Ахмат Грозный',score:2},
    away:{name:'Акрон Тольятти',score:1},time:'2026-10-18T14:00:00Z'};
  const good=compareSportScoreDay(csv,'2026-10-18',{response:[russian]});
  assert.equal(good.rplExplicitlyLabeled,1);
  assert.equal(good.pairsMatchingSource,1);
  assert.equal(good.differentFinishedScores,0);
  const mismatched=compareSportScoreDay(csv,'2026-10-18',{
    response:[{...russian,time:'2026-10-19T14:00:00Z'}]
  });
  assert.equal(mismatched.kickoffDateDisagreements,1);
  assert.equal(mismatched.pairsMatchingSource,0);
  assert.equal(mismatched.matchTruthVerified,false);
});
test('anonymous foreign and ambiguous generic league events never become RPL',()=>{
  const out=compareSportScoreDay(csv,'2026-10-18',[
    {competition:'Premier League',home:'Akhmat Grozny',away:'Akron Tolyatti'},
    {competition:'English Premier League',home:'Akhmat Grozny',away:'Akron Tolyatti'},
    {home:'Akhmat Grozny',away:'Akron Tolyatti'}
  ]);
  assert.equal(out.rplExplicitlyLabeled,0);
  assert.equal(out.pairsMatchingSource,0);
  assert.equal(out.scheduleCoverageVerified,false);
});
test('unknown schemas, errors and clipped pages never establish false zero coverage',()=>{
  const empty=compareSportScoreDay(csv,'2026-10-18',{surprise:[match]});
  assert.equal(empty.apiSchemaRecognized,false);
  assert.equal(empty.rplExplicitlyLabeled,null);
  assert.equal(empty.scheduleCoverageVerified,false);
  const capped=compareSportScoreDay(csv,'2026-10-18',{fixtures:Array(200).fill({
    competition:'English Premier League',home:'Liverpool',away:'Arsenal'
  })});
  assert.equal(capped.apiLimitReached,true);
  assert.equal(capped.scheduleCoverageVerified,false);
  const errors=runDayProbe(csv,days.map(date=>({date,httpStatus:403})));
  assert.ok(errors.days.every(d=>d.reachable===false&&d.sourceAvailabilityVerified===false));
  assert.equal(errors.anyExplicitRplMatchesObserved,false);
  assert.equal(errors.rightsForBulkExtractionOrModelTrainingVerified,false);
});
test('unmapped 2026 team and repeated match do not become independent corroboration',()=>{
  const unknown=compareSportScoreDay(csv,'2026-10-18',{
    matches:[{...match,home:'Unknown club'}]
  });
  assert.equal(unknown.unmappedOrAmbiguous,1);
  assert.equal(unknown.pairsMatchingSource,0);
  const duplicated=compareSportScoreDay(csv,'2026-10-18',{fixtures:[match,match]});
  assert.equal(duplicated.pairsMatchingSource,1);
  assert.equal(duplicated.unmappedOrAmbiguous,1);
});
test('exact six dates and fixed source shape are mandatory',()=>{
  const all=days.map(date=>({date,httpStatus:200,payload:{fixtures:[]}}));
  const v=runDayProbe(csv,all);
  assert.equal(v.footbolnoSeasonRowCount,240);
  assert.equal(v.footbolnoFinishedCount,1);
  assert.equal(v.footbolnoScheduledCount,239);
  assert.equal(v.productionIntegrationEnabled,false);
  assert.equal(v.rawProviderDataStored,false);
  assert.throws(()=>runDayProbe(csv,all.slice(0,5)),/Exactly six/);
  assert.throws(()=>compareSportScoreDay(csv,'2026-10-26',[]),/outside six/);
});
test('standalone workflow uses only six fixed no-key GETs and no stored raw data',()=>{
  const flow=readFileSync(new URL('../.github/workflows/m0-sportscore-day-research.yml',import.meta.url),'utf8');
  assert.match(flow,/sportscore\.com\/api\/v1\/fixtures\/\?sport=football&date=\$day&limit=200/);
  assert.match(flow,/m0-sportscore-day-research\.mjs/);
  assert.match(flow,/Powered by SportScore/);
  assert.match(flow,/rm -rf "\$work"/);
  assert.match(flow,/m0-sportscore-day-research\.mjs[\s\S]*?tee -a "\$GITHUB_STEP_SUMMARY"/,
    'Only redacted aggregate JSON must reach the visible workflow log');
  assert.doesNotMatch(flow,/upload-artifact|schedule:|git push|api.?key|token:|supabase|npm install/i);
});

test('actual CLI stdout exposes redacted numeric fields but never synthetic provider rows',()=>{
  const work=mkdtempSync(join(tmpdir(),'ff-m0-sportscore-'));
  try{
    const sourceFile=join(work,'source.csv');
    const dayFile=join(work,'day.json');
    const manifestFile=join(work,'manifest.json');
    writeFileSync(sourceFile,csv,'utf8');
    writeFileSync(dayFile,JSON.stringify({fixtures:[match]}),'utf8');
    const manifest=days.map(date=>({
      date,status:date==='2026-10-18'?200:503,file:dayFile
    }));
    writeFileSync(manifestFile,JSON.stringify(manifest),'utf8');
    const output=execFileSync(process.execPath,[
      fileURLToPath(new URL('../scripts/m0-sportscore-day-research.mjs',import.meta.url)),
      sourceFile,manifestFile
    ],{encoding:'utf8'});
    const result=JSON.parse(output);
    assert.equal(result.anyExplicitRplMatchesObserved,true);
    assert.equal(result.days[1].pairsMatchingSource,1);
    assert.equal(result.days[1].differentFinishedScores,0);
    assert.equal(result.rawProviderDataStored,false);
    assert.doesNotMatch(output,/Akhmat Grozny|Akron Tolyatti|match_id|home_score|source.csv|day.json/);
  }finally{rmSync(work,{recursive:true,force:true})}
});
