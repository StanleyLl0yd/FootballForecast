import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {comparePublishedRplScorelines} from '../scripts/m0-scoreline-histogram-crosscheck.mjs';

const teams=Array.from({length:16},(_,i)=>'Team '+String(i+1).padStart(2,'0'));
function examples(scoreAt=()=>[1,0]){
  const pairs=teams.flatMap((home,i)=>teams.flatMap((away,j)=>
    i===j?[]:[{home,away,i,j}]));
  const csvHeader=['match_id','league_id','season','date_utc','status',
    'home_id','away_id','home_goals','away_goals','home','away','time_confirmed'];
  const csv=[csvHeader.join(','),...pairs.map((p,n)=>{
    const [home,away]=scoreAt(n);
    return [n+1,'235','2024/2025','2025-03-01T13:00:00Z',
      'finished',p.i+1,p.j+1,home,away,p.home,p.away,1].join(',');
  })].join('\n')+'\n';
  const txt=['= Russia Premier League 2024/25','# Teams 16','# Matches 240',
    '▪ Matchday 1',...pairs.map((p,n)=>{
      const [home,away]=scoreAt(n);
      return '    14:00  '+p.home.padEnd(24)+'v '+p.away.padEnd(24)+
        home+'-'+away+' (0-0)';
    })].join('\n')+'\n';
  return {csv,txt};
}
test('240 paired CC0 and CC BY synthetic matches yield aggregate-only histogram parity',()=>{
  const {csv,txt}=examples();
  const result=comparePublishedRplScorelines(csv,txt);
  assert.equal(result.equalScorelineFrequencyDistribution,true);
  assert.equal(result.differentScorelineBuckets,0);
  assert.deepEqual(result.discrepancies,[]);
  assert.deepEqual(result.finishedFixtureCounts,{footbolno:240,openFootball:240});
  assert.deepEqual(result.sourceReportedGoals,{
    footbolno:{home:240,away:0},openFootball:{home:240,away:0}
  });
  assert.equal(result.matchByMatchAgreementVerified,false);
  assert.equal(result.authorizedForProductionTraining,false);
  assert.equal(result.originalRowsPersisted,false);
  assert.doesNotMatch(JSON.stringify(result),/Team 01|Team 02|match_id|home_id/);
});
test('silent redistributed goal errors are detected even when league goals still agree',()=>{
  const input=examples();
  const wrong=examples(n=>n===0?[2,0]:n===1?[0,0]:[1,0]);
  const result=comparePublishedRplScorelines(wrong.csv,input.txt);
  assert.equal(result.equalScorelineFrequencyDistribution,false);
  assert.equal(result.differentScorelineBuckets,3);
  assert.equal(result.sumAbsoluteBucketDifferences,4);
  assert.deepEqual(result.sourceReportedGoals,{
    footbolno:{home:240,away:0},openFootball:{home:240,away:0}
  });
  assert.equal(result.matchByMatchAgreementVerified,false);
});
test('equal score histograms cannot establish that individual games agree',()=>{
  const input=examples(n=>n===0?[1,0]:n===1?[0,1]:[1,0]);
  const swapped=examples(n=>n===0?[0,1]:n===1?[1,0]:[1,0]);
  const result=comparePublishedRplScorelines(swapped.csv,input.txt);
  assert.equal(result.equalScorelineFrequencyDistribution,true);
  assert.equal(result.matchByMatchAgreementVerified,false);
  assert.equal(result.strictPrematchSnapshotsVerified,false);
});
test('wrong season, incomplete schedule, changed status and awarded outcomes fail closed',()=>{
  const input=examples();
  assert.throws(()=>comparePublishedRplScorelines(input.csv,
    input.txt.replace('2024/25','2023/24')),/Expected published/);
  assert.throws(()=>comparePublishedRplScorelines(input.csv,
    input.txt.replace('# Matches 240','# Matches 239')),/full 240/);
  assert.throws(()=>comparePublishedRplScorelines(input.csv.replace(
    ',finished,',',scheduled,'),input.txt),/structurally complete/);
  assert.throws(()=>comparePublishedRplScorelines(input.csv,
    input.txt.replace(' (0-0)',' (0-0) [awarded]')),/Awarded/);
});
test('CI workflow uses one Footbolno CSV and one immutable CC0 file, no raw artifacts',()=>{
  const ci=readFileSync(new URL('../.github/workflows/m0-footbolno-csv-research.yml',
    import.meta.url),'utf8');
  assert.match(ci,/raw\.githubusercontent\.com\/openfootball\/europe\/63df627f3c87ce71708f016522ea236cf74332c3\/russia\/2024-25_ru1\.txt/);
  assert.match(ci,/m0-scoreline-histogram-crosscheck\.mjs/);
  assert.match(ci,/m0-scoreline-histogram-crosscheck\.test\.mjs/);
  assert.match(ci,/rm -rf "\$work"/);
  assert.doesNotMatch(ci,/uses:\s*actions\/upload-artifact|git\s+push|service[_-]role\s*:|^\s+schedule:/im);
});
