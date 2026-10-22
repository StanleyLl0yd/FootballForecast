import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {discoverRplCompetition,compareFilteredSixDays} from
  '../scripts/m0-sportscore-filtered-rpl-research.mjs';

const DAYS=['2026-10-17','2026-10-18','2026-10-19',
  '2026-10-23','2026-10-24','2026-10-25'];
const TEAMS=['Ахмат','Акрон','Балтика','ЦСКА','Динамо Махачкала',
  'Динамо Москва','Факел','Краснодар','Крылья Советов','Локомотив',
  'Оренбург','Родина','Ростов','Рубин','Спартак','Зенит'];
const csv=(()=>{
  const rows=['match_id,league_id,season,status,home_id,away_id,home_goals,away_goals,date_utc,time_confirmed,home,away'];
  let n=0;
  for(let h=0;h<16;h++)for(let a=0;a<16;a++){
    if(h===a)continue;
    n++;
    const day=n===1?'2026-10-19':n===2?'2026-10-24':'2026-11-02';
    const finished=n===1;
    rows.push([n,'235','2026/2027',finished?'finished':'scheduled',h+1,a+1,
      finished?2:'',finished?1:'',day+'T12:00:00Z',1,TEAMS[h],TEAMS[a]].join(','));
  }
  return rows.join('\n')+'\n';
})();
const competition={competitions:[{name:'Russian Premier League',slug:'russian-premier-league'}]};
test('only exact named Russia league with validated slug may be selected',()=>{
  const r=discoverRplCompetition({data:competition});
  assert.equal(r.searchSchemaRecognized,true);
  assert.equal(r.exactRplCandidates,1);
  assert.equal(r.selectedSlug,'russian-premier-league');
  const generic=discoverRplCompetition({competitions:[
    {name:'Premier League',country:'England',slug:'premier-league'}
  ]});
  assert.equal(generic.selectedSlug,null);
  assert.equal(discoverRplCompetition({competitions:[
    {name:'Premier League',country:{name:'Russia'},slug:'premier-league-ru'}
  ]}).selectedSlug,'premier-league-ru');
});
test('never guess a slug for duplicated or malformed search results',()=>{
  const arr=[{name:'Russian Premier League',slug:'rpl-1'},
    {name:'Russian Premier League',slug:'rpl-2'}];
  assert.equal(discoverRplCompetition({results:{leagues:arr}}).selectedSlug,null);
  assert.equal(discoverRplCompetition({competitions:[
    {name:'Russian Premier League',slug:'rpl?token=abc'}
  ]}).selectedSlug,null);
  assert.equal(discoverRplCompetition({data:{teams:[{name:'Russian Premier League'}]}})
    .searchSchemaRecognized,false);
  assert.equal(discoverRplCompetition([arr]).searchSchemaRecognized,false);
});
test('filtered 6 day observation still refuses official truth and ML licensing',()=>{
  const days=DAYS.map(date=>({date,status:200,payload:{fixtures:
    date==='2026-10-19'?[{
      competition:'Russian Premier League',home:'Ахмат',away:'Акрон',
      home_score:2,away_score:1
    }]:date==='2026-10-24'?[{
      competition:'Russian Premier League',home:'Ахмат',away:'Балтика'
    }]:[]}}));
  const x=compareFilteredSixDays(csv,competition,days);
  assert.equal(x.totalMatchedPairs,2);
  assert.equal(x.daysWithMatchingPairs,2);
  assert.equal(x.daysAtPageCap,0);
  assert.equal(x.providerCompleteCoverageVerified,false);
  assert.equal(x.freeModelTrainingRightsVerified,false);
  assert.equal(x.rawRecordsPersisted,false);
  assert.equal(x.days.length,6);
  assert.doesNotMatch(JSON.stringify(x),/Ахмат|Акрон|Балтика|russian-premier-league/);
});
test('fail closed on unknown/unsafe competition slug, wrong day or partial sample',()=>{
  const days=DAYS.map(date=>({date,status:200,payload:{fixtures:[]}}));
  assert.throws(()=>compareFilteredSixDays(csv,{competitions:[]},days),/unique competition/);
  assert.throws(()=>compareFilteredSixDays(csv,competition,days.slice(0,5)),/six days/);
  assert.throws(()=>compareFilteredSixDays(csv,competition,[{...days[0],date:'2026-10-10'},...days.slice(1)]),/fixed UTC/);
});
test('actual discovery CLI writes trusted slug privately and logs only counts',()=>{
  const work=mkdtempSync(join(tmpdir(),'ff-filtered-'));
  try{
    const search=join(work,'search.json'),slug=join(work,'slug.txt');
    writeFileSync(search,JSON.stringify(competition));
    const out=execFileSync(process.execPath,[
      fileURLToPath(new URL('../scripts/m0-sportscore-filtered-rpl-research.mjs',import.meta.url)),
      'discover',search,slug
    ],{encoding:'utf8'});
    assert.equal(readFileSync(slug,'utf8'),'russian-premier-league');
    const printed=JSON.parse(out);
    assert.equal(printed.validatedCompetitionFilterAvailable,true);
    assert.equal(printed.rawResultsPersisted,false);
    assert.doesNotMatch(out,/russian-premier-league|search.json|slug.txt/);
  }finally{rmSync(work,{recursive:true,force:true})}
});
test('one-shot CI uses search-derived competition filter, one fixed GET per day',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/m0-sportscore-filtered-rpl-research.yml',import.meta.url),'utf8');
  assert.match(workflow,/\/api\/v1\/search\/\?q=Russian%20Premier%20League&sport=football&limit=10/);
  assert.match(workflow,/competition=\$slug/);
  assert.match(workflow,/m0-sportscore-filtered-rpl-research\.mjs/);
  assert.match(workflow,/Powered by SportScore/);
  assert.match(workflow,/rm -rf "\$work"/);
  assert.doesNotMatch(workflow,/upload-artifact|schedule:|git push|token:|supabase|X-Api-Key|npm install/i);
});
