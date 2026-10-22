import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {reconcilePublishedRplFixtures} from '../scripts/m0-cross-source-fixture-reconcile.mjs';

const clubs=[
  ['Lokomotiv Moskva','Локомотив Москва'],['Krylia Sovetov','Крылья Советов'],
  ['FK Rostov','Ростов'],['Dinamo Moskva','Динамо Москва'],
  ['FK Orenburg','Оренбург'],['Akhmat Grozny','Ахмат Грозный'],
  ['FK Khimki','Химки'],['FK Dinamo Makhachkala','Динамо Махачкала'],
  ['FK Nizhny Novgorod','Пари Нижний Новгород'],['Rubin Kazan','Рубин Казань'],
  ['CSKA Moskva','ЦСКА Москва'],['Spartak Moskva','Спартак Москва'],
  ['Fakel Voronezh','Факел Воронеж'],['FK Krasnodar','Краснодар'],
  ['Zenit St. Petersburg','Зенит Санкт-Петербург'],['Akron Tolyatti','Акрон Тольятти']
];
function fixtures(){
  let wheel=Array.from({length:16},(_,i)=>i);
  const first=[];
  for(let round=0;round<15;round++){
    const pairs=[];
    for(let i=0;i<8;i++){
      const a=wheel[i],b=wheel[15-i];
      pairs.push((round+i)%2===0?{home:a,away:b}:{home:b,away:a});
    }
    first.push(pairs);
    wheel=[wheel[0],wheel[15],...wheel.slice(1,15)];
  }
  return [...first,...first.map(round=>round.map(({home,away})=>({home:away,away:home})))];
}
function makeSamples(modify=()=>{}){
  const all=fixtures();
  const rows=[];
  const text=['= Russia Premier League 2024/25','# Teams 16','# Matches 240'];
  let n=0;
  all.forEach((round,i)=>{
    const date=new Date(Date.UTC(2024,6,20+i*7));
    const day=date.toISOString().slice(0,10);
    const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(date);
    // OpenFootball independently supplies explicit date context.
    text.push('▪ Matchday '+(i+1),'  '+fmt.replace(',','').replace(',',''));
    round.forEach(({home,away})=>{
      const [h,a]=[clubs[home],clubs[away]];
      const source={id:String(++n),home:h[1],away:a[1],
        date:day,homeGoals:(n%3),awayGoals:n%2,status:'finished'};
      const changed=modify({...source},n);
      const entry=changed||source;
      rows.push([''+n,'235','2024/2025',entry.date+'T12:00:00Z',entry.status,
        String(home+1),String(away+1),entry.homeGoals,entry.awayGoals,
        entry.home,entry.away,'1'].join(','));
      text.push('    14:00  '+h[0].padEnd(24)+'v '+a[0].padEnd(24)+
        source.homeGoals+'-'+source.awayGoals+' (0-0)');
    });
  });
  const csv=['match_id,league_id,season,date_utc,status,home_id,away_id,home_goals,away_goals,home,away,time_confirmed',...rows].join('\n')+'\n';
  return {csv,txt:text.join('\n')+'\n'};
}
test('240 differently named Russian and English fixtures match by explicit club identity and score',()=>{
  const {csv,txt}=makeSamples();
  const x=reconcilePublishedRplFixtures(csv,txt);
  assert.equal(x.compared,240);
  assert.equal(x.referenceCount,240);
  assert.equal(x.matchedDirectedFixtures,240);
  assert.equal(x.mismatchedFixtures,0);
  assert.equal(x.observedPublisherAndOpenFootballAgreement,true,JSON.stringify(x));
  assert.equal(x.researchOnly,true);
  assert.equal(x.officialMatchTruthVerified,false);
  assert.equal(x.authorizedProductionTraining,false);
  assert.doesNotMatch(JSON.stringify(x),/Локомотив Москва|Динамо Москва|match_id|Team 01|home_id/);
});
test('different scores on the same directed fixtures are reported even with unchanged total goals',()=>{
  const baseline=makeSamples();
  const altered=makeSamples((row,n)=>n===1?{...row,homeGoals:row.homeGoals+1}:
    n===2?{...row,homeGoals:row.homeGoals-1}:row);
  const x=reconcilePublishedRplFixtures(altered.csv,baseline.txt);
  assert.equal(x.mismatchedFixtures,2);
  assert.equal(x.differingFields.homeGoals,2);
  assert.equal(x.matchedDirectedFixtures,240);
  assert.equal(x.observedPublisherAndOpenFootballAgreement,false);
});
test('a changed date produces one explicitly classified fixture disagreement',()=>{
  const baseline=makeSamples();
  const altered=makeSamples((row,n)=>n===1?{...row,date:'2024-07-21'}:row);
  const x=reconcilePublishedRplFixtures(altered.csv,baseline.txt);
  assert.equal(x.mismatchedFixtures,1);
  assert.equal(x.differingFields.date,1);
});
test('unknown club identity or unsupported status prevents misleading agreement',()=>{
  const {csv,txt}=makeSamples();
  assert.throws(()=>reconcilePublishedRplFixtures(
    csv.replace('Локомотив Москва','Неизвестный клуб'),txt),/mapping or completed/);
  assert.throws(()=>reconcilePublishedRplFixtures(
    csv.replace(',finished,',',scheduled,'),txt),/mapping or completed/);
  assert.throws(()=>reconcilePublishedRplFixtures(
    csv.replace('2024/2025','2023/2024'),txt),/mapping or completed/);
});
test('reconciliation never emits source IDs or full fixture rows in failures',()=>{
  const {csv,txt}=makeSamples();
  assert.throws(()=>reconcilePublishedRplFixtures(csv,'invalid source'),/invalid season\/source text/);
  assert.throws(()=>reconcilePublishedRplFixtures(csv.replace('\n2,235,','\n1,235,'),txt),
    /mapping or completed/);
});
test('one-off CI workflow remains bounded, unattributed raw rows are never uploaded',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/m0-footbolno-csv-research.yml',import.meta.url),'utf8');
  assert.match(workflow,/m0-cross-source-fixture-reconcile\.mjs/);
  assert.match(workflow,/m0-cross-source-fixture-reconcile\.test\.mjs/);
  assert.match(workflow,/raw\.githubusercontent\.com\/openfootball\/europe\/63df627f3c87ce71708f016522ea236cf74332c3/);
  assert.match(workflow,/rm -rf "\$work"/);
  assert.doesNotMatch(workflow,/uses:\s*actions\/upload-artifact|git\s+push|^ *schedule:/mi);
});
