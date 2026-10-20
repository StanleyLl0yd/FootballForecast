// M0 production-safe verification of the anonymous Supabase PostgREST boundary.
// No valid INSERT payload, matching UPDATE/DELETE filter, migration or write operation.
// This script is intentionally NOT part of automatic push/PR CI.
import {pathToFileURL} from 'node:url';

export const projectOrigin='https://upulkesaiwnwfagjgteh.supabase.co';
const noMatch='00000000-0000-0000-0000-000000000000';
export const operations=Object.freeze([
  {label:'Public matches SELECT',method:'GET',path:'/rest/v1/ff_matches?select=id&limit=1',allow:true},
  {label:'Private source metadata SELECT',method:'GET',path:'/rest/v1/ff_sources?select=id&limit=1'},
  {label:'Private source records SELECT',method:'GET',path:'/rest/v1/ff_source_records?select=id&limit=1'},
  {label:'Private access grants SELECT',method:'GET',path:'/rest/v1/ff_access_grants?select=user_id&limit=1'},
  {label:'Impossible empty fixture INSERT',method:'POST',path:'/rest/v1/ff_matches',body:'{}'},
  {label:'Impossible empty forecast INSERT',method:'POST',path:'/rest/v1/ff_forecasts',body:'{}'},
  {label:'Unmatched fixture UPDATE',method:'PATCH',path:`/rest/v1/ff_matches?id=eq.${noMatch}`,body:'{"status":"cancelled"}'},
  {label:'Unmatched forecast DELETE',method:'DELETE',path:`/rest/v1/ff_forecasts?id=eq.${noMatch}`},
]);

export async function checkAnonymousRestBoundary(key,{fetchImpl=fetch,timeoutMs=10000}={}) {
  if(typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key))
    throw new Error('A modern Supabase publishable key must be supplied via the environment');
  if(typeof timeoutMs!=='number'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
    throw new Error('Invalid timeout');
  const results=[];
  for(const op of operations){
    const headers={apikey:key,Accept:'application/json'};
    if(op.body!==undefined)headers['Content-Type']='application/json';
    let response;
    try{
      response=await fetchImpl(projectOrigin+op.path,{method:op.method,headers,
        ...(op.body===undefined?{}:{body:op.body}),redirect:'error',cache:'no-store',
        signal:AbortSignal.timeout(timeoutMs)});
    }catch{
      throw new Error(`${op.label}: transport/timeout error (details suppressed)`);
    }
    let payload;
    try{payload=await response.json();}
    catch{throw new Error(`${op.label}: invalid JSON response (HTTP ${response.status})`);}
    if(op.allow){
      if(response.status!==200||!Array.isArray(payload)||payload.length>1)
        throw new Error(`${op.label}: expected exactly a readable array with max 1 row (HTTP ${response.status})`);
    }else if(![401,403].includes(response.status)||payload?.code!=='42501'){
      // POST bodies lack mandatory non-null fields; mutation filters use the zero UUID.
      // If grants unexpectedly broaden, these probes still cannot alter real data.
      throw new Error(`${op.label}: expected SQLSTATE 42501 refusal, got HTTP ${response.status} / code ${typeof payload?.code==='string'?payload.code:'(missing)'}`);
    }
    results.push({label:op.label,method:op.method,httpStatus:response.status,
      outcome:op.allow?'read_pass':'denied_pass'});
  }
  return {project:projectOrigin,publicRead:'PASS',denied:results.length-1,results,
    safety:'This establishes a live HTTP authorization boundary, not backup recovery or authorized provider data.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==2){
    console.error('Usage: FF_SUPABASE_PUBLISHABLE_KEY=<key> node scripts/m0-rest-denials.mjs');
    process.exitCode=2;
  }else{
    try{
      const result=await checkAnonymousRestBoundary(process.env.FF_SUPABASE_PUBLISHABLE_KEY);
      console.log(JSON.stringify(result,null,2));
    }catch(error){
      console.error('FAIL:',error.message);process.exitCode=1;
    }
  }
}
