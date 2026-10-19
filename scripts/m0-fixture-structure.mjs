// M0 offline fixture-structure audit ONLY. No network, import or source approval.
// Designed to catch duplicate/missing home-away fixture identities before model training.
const rowPattern=/^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s{2,}v\s+(.+?)\s{2,}(\d+)-(\d+)(?:\s|$)/;

export function auditFootballTxt(source,{expectedTeams=16,expectedMatches=240}={}) {
  if(typeof source!=='string') throw new TypeError('Fixture input must be a string');
  if(!Number.isSafeInteger(expectedTeams)||expectedTeams<2||
     !Number.isSafeInteger(expectedMatches)||expectedMatches<1)
    throw new RangeError('Expected league dimensions must be positive integers');
  const lines=source.split(/\r?\n/);
  const header=key=>{
    const raw=lines.find(line=>new RegExp('^#\\s*'+key+'\\s+\\d+\\s*$','i').test(line));
    return raw ? Number(raw.match(/\d+\s*$/)[0]) : null;
  };
  const declaredTeams=header('Teams'),declaredMatches=header('Matches');
  const rawRows=lines.map((line,i)=>({line,number:i+1}))
    .filter(x=>/\s+v\s+/.test(x.line));
  const parsed=[],invalidRows=[];
  for(const item of rawRows) {
    const match=item.line.match(rowPattern);
    if(!match){
      invalidRows.push({line:item.number,reason:'missing or malformed score/teams'});
      continue;
    }
    const home=match[1].trim(),away=match[2].trim();
    const goals=[Number(match[3]),Number(match[4])];
    if(!home||!away||home===away||goals.some(n=>!Number.isSafeInteger(n))){
      invalidRows.push({line:item.number,reason:'invalid fixture identity or result'});
      continue;
    }
    parsed.push({home,away,homeGoals:goals[0],awayGoals:goals[1],line:item.number});
  }
  const clubs=[...new Set(parsed.flatMap(x=>[x.home,x.away]))].sort();
  const pairs=new Map();
  for(const item of parsed){
    const key=JSON.stringify([item.home,item.away]);
    pairs.set(key,[...(pairs.get(key)||[]),item.line]);
  }
  const duplicatePairs=[...pairs.entries()].filter(([,lines])=>lines.length>1)
    .map(([key,lines])=>({home:JSON.parse(key)[0],away:JSON.parse(key)[1],lines}));
  const missingPairs=clubs.flatMap(home=>clubs
    .filter(away=>home!==away&&!pairs.has(JSON.stringify([home,away])))
    .map(away=>({home,away})));
  const violations=[];
  if(declaredTeams!==expectedTeams)violations.push('declared teams mismatch');
  if(declaredMatches!==expectedMatches)violations.push('declared matches mismatch');
  if(rawRows.length!==expectedMatches)violations.push('match-row count mismatch');
  if(parsed.length!==rawRows.length)violations.push('malformed match rows');
  if(clubs.length!==expectedTeams)violations.push('distinct team count mismatch');
  if(parsed.length!==expectedMatches)violations.push('parsed match count mismatch');
  if(parsed.length!==expectedTeams*(expectedTeams-1))
    violations.push('not a complete double round-robin');
  if(duplicatePairs.length)violations.push('duplicate directed fixtures');
  if(missingPairs.length)violations.push('missing directed fixtures');
  return {
    structuralOnly:true,ok:violations.length===0,
    declaredTeams,declaredMatches,matchRows:rawRows.length,
    parsedRows:parsed.length,teamCount:clubs.length,directedPairs:pairs.size,
    invalidRows,duplicatePairs,missingPairs,violations
  };
}
