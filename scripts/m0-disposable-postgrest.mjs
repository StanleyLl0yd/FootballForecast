// Real anonymous PostgREST HTTP contract against a disposable PostgreSQL 17
// service in CI. This NEVER touches the production Supabase project.
// Fail closed on unexpected success, mismatched SQLSTATE or missing endpoints.
import {pathToFileURL} from 'node:url';
import {operations} from './m0-rest-denials.mjs';

export const disposableOrigin='http://127.0.0.1:3000';

export async function checkDisposablePostgrest({fetchImpl=fetch,timeoutMs=4000}={}){
  if(typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||
     timeoutMs<100||timeoutMs>30000)throw Error('Invalid local PostgREST options');
  const results=[];
  for(const op of operations){
    if(!op.path.startsWith('/rest/v1/ff_')||
       !['GET','POST','PATCH','DELETE'].includes(op.method))
      throw Error('Non-allowlisted HTTP operation');
    const path=op.path.slice('/rest/v1'.length);
    let response;
    try{
      response=await fetchImpl(disposableOrigin+path,{
        method:op.method,
        headers:{Accept:'application/json',
          ...(op.body===undefined?{}:{'Content-Type':'application/json'})},
        ...(op.body===undefined?{}:{body:op.body}),
        redirect:'error',cache:'no-store',
        signal:AbortSignal.timeout(timeoutMs)
      });
    }catch{throw Error(op.label+': disposable HTTP transport failure')}
    let payload;
    try{payload=await response.json()}
    catch{throw Error(op.label+': unexpected non-JSON response')}
    if(op.allow){
      if(response.status!==200||!Array.isArray(payload)||payload.length>1)
        throw Error(op.label+': anonymous public GET contract failed');
    }else{
      const privilegeDenied=[401,403].includes(response.status)&&
        payload?.code==='42501';
      // PostgreSQL privilege denial and PostgREST's inaccessible-table
      // concealment are both safe for PRIVATE metadata-only SELECTs.
      const metadataHidden=op.method==='GET'&&op.label.startsWith('Private ')&&
        response.status===404&&payload?.code==='PGRST205';
      if(!privilegeDenied&&!metadataHidden)
        throw Error(op.label+': forbidden operation was not explicitly denied');
    }
    results.push({label:op.label,method:op.method,httpStatus:response.status,
      outcome:op.allow?'read_pass':'denied_pass'});
  }
  return {mode:'DISPOSABLE_POSTGREST_NOT_PRODUCTION',operationCount:results.length,
    denied:results.filter(r=>r.outcome==='denied_pass').length,
    results,productionPostgrestVerified:false,productionRecoveryVerified:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==2){
    console.error('No arguments accepted; localhost:3000 only');
    process.exitCode=2;
  }else{
    try{
      const result=await checkDisposablePostgrest();
      console.log(JSON.stringify(result,null,2));
    }catch(error){
      console.error('FAIL:',error.message);
      process.exitCode=1;
    }
  }
}
