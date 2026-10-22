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
