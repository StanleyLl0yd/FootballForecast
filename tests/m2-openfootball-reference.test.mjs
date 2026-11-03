import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  OPENFOOTBALL_REFERENCE,
  inspectPinnedOpenFootball2024,
  parseOpenFootball2024Reference
} from '../scripts/m2-openfootball-reference.mjs';

const teams=Array.from({length:16},(_,i)=>'Synthetic Club '+String(i).padStart(2,'0'));
const line=(home,away)=>'    14:00  '+home.padEnd(25)+'v '+away.padEnd(25)+'1-0 (0-0)';
function source(){
  const firstHalf=[];
  const rotating=teams.slice(1);
  for(let i=0;i<15;i++){
    const round=[teams[0],...rotating];
    firstHalf.push(Array.from({length:8},(_,j)=>[round[j],round[15-j]]));
    rotating.unshift(rotating.pop());
  }
  const fixtures=[
    ...firstHalf,
    ...firstHalf.map(round=>round.map(([home,away])=>[away,home]))
  ];
  const records=['= Russia Premier League 2024/25','# Teams 16','# Matches 240'];
  for(let i=0;i<30;i++)records.push(
    '▪ Matchday '+(i+1),'  Sat Jul 20 2024',
    ...fixtures[i].map(([home,away])=>line(home,away))
  );
  return records.join('\n')+'\n';
}
test('reuses mechanically validated 240/16 fixture parsing without inventing kickoff times',()=>{
  const data=parseOpenFootball2024Reference(source());
  assert.equal(data.length,240);
  assert.ok(Object.isFrozen(data));
  const clubs=new Set(data.flatMap(x=>[x.homeName,x.awayName]));
  assert.equal(clubs.size,16);
  assert.deepEqual(new Set(data.map(x=>x.round)).size,30);
  assert.equal(data.filter(x=>x.resultType==='played').length,240);
  assert.ok(data.every(x=>x.kickoffAtUtc===null&&x.historicalPrematchVerified===false));
  assert.ok(data.every(x=>x.calendarDateUtc==='2024-07-20'));
  assert.equal(data[0].homeGoals,1);
  assert.equal(data[0].awayGoals,0);
  assert.ok(!('sourceMatchId' in data[0]));
  assert.ok(!('approvedForModel' in data[0]));
});
test('fixed source version cannot be substituted with a plausible synthetic or modified file',()=>{
  const content=new TextEncoder().encode(source());
  assert.equal(OPENFOOTBALL_REFERENCE.repositoryCommit,
    '63df627f3c87ce71708f016522ea236cf74332c3');
  assert.equal(OPENFOOTBALL_REFERENCE.gitBlobSha1,
    '6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc');
  assert.throws(()=>inspectPinnedOpenFootball2024(content),/immutable reviewed Git blob/);
  assert.throws(()=>inspectPinnedOpenFootball2024(Buffer.alloc(200001)),/byte budget/);
  assert.throws(()=>inspectPinnedOpenFootball2024(new Uint8Array()),/byte budget/);
  assert.throws(()=>inspectPinnedOpenFootball2024('fake'),/byte budget/);
});
test('bad season, duplicate fixture, invalid round, awarded game or source annotation refused',()=>{
  const s=source(),first=line(teams[0],teams[1]);
  const mutated=[
    s.replace('Russia Premier League 2024/25','Russia Premier League 2025/26'),
    s.replace(line(teams[0],teams[2]),first),
    s.replace('▪ Matchday 2','▪ Matchday 1'),
    s.replace(first,first+' [awarded]'),
    s.replace(first,first+' [unknown]'),
    s.replace(first,first.replace('1-0 (0-0)','25-0 (0-0)')),
    s.replace('Sat Jul 20 2024','Sun Jul 20 2025'),
    s.replace('Sat Jul 20 2024','Wed Jul 20 2024'),
    s.replace('# Matches 240','# Matches 239'),
    s.replace(first,'')
  ];
  for(const bad of mutated)assert.throws(
    ()=>parseOpenFootball2024Reference(bad),
    /M2 OpenFootball reference refused/
  );
});
test('a fixture reference cannot be mistaken for a train-season approved as-of adapter',()=>{
  const data=parseOpenFootball2024Reference(source());
  assert.equal(OPENFOOTBALL_REFERENCE.role,'independent_historical_reference_only');
  assert.ok(!data.some(f=>Object.hasOwn(f,'publishedAtUtc')));
  assert.ok(!data.some(f=>Object.hasOwn(f,'sourceFileSha256')));
  assert.ok(!data.some(f=>Object.hasOwn(f,'modelTrained')));
  assert.throws(()=>parseOpenFootball2024Reference(''),/M2 OpenFootball reference refused/);
  assert.throws(()=>parseOpenFootball2024Reference(null),/M2 OpenFootball reference refused/);
});
