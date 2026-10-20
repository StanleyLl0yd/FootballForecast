// Manual/one-shot M0 publisher endpoint metadata observation.
// NO CSV row retrieval, no ingestion, training, source clearance, paid service,
// credentials, retries, provider record persistence, or user-controlled URLs.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const manifestUrl='https://footbolno.ru/data/index.json';
export const matchesCsvUrl='https://footbolno.ru/data/league/235-matches.csv';
const maxManifestBytes=65536;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const acceptableStatus=status=>Number.isInteger(status)&&status>=200&&status<300;

async function request(fetchImpl,url,method,timeoutMs){
  return fetchImpl(url,{
    method,headers:{Accept:method==='GET'?'application/json':'text/csv, */*;q=0.1'},
    cache:'no-store',redirect:'error',credentials:'omit',
    signal:AbortSignal.timeout(timeoutMs)
  });
}
async function inspectManifest(fetchImpl,timeoutMs){
  let response;
  try{response=await request(fetchImpl,manifestUrl,'GET',timeoutMs)}
  catch{return {status:'UNREACHABLE_FROM_RUNNER',httpStatus:null}};
  if(!acceptableStatus(response.status))
    return {status:'HTTP_NON_SUCCESS',httpStatus:response.status};
  // Not even a single >64 KiB response is allowed to be retained or hashed.
  const advertised=response.headers.get('content-length');
  const claimedBytes=advertised!==null&&/^\d+$/.test(advertised)?Number(advertised):null;
  if(claimedBytes!==null&&(!Number.isSafeInteger(claimedBytes)||claimedBytes>maxManifestBytes))
    return {status:'OVER_LIMIT',httpStatus:response.status};
  if(!response.body)
    return {status:'EMPTY_BODY',httpStatus:response.status};
  let parts=[],size=0;
  try{
    const reader=response.body.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw new Error('Invalid chunk type');
      size+=value.length;
      if(size>maxManifestBytes){
        await reader.cancel().catch(()=>{});
        return {status:'OVER_LIMIT',httpStatus:response.status};
      }
      parts.push(value);
    }
  }catch{return {status:'TRANSFER_FAILED',httpStatus:response.status}};
  if(size===0)return {status:'EMPTY_BODY',httpStatus:response.status};
  const bytes=Buffer.concat(parts,size);
  let json;
  try{
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    json=JSON.parse(text);
  }catch{return {status:'UNREADABLE_JSON',httpStatus:response.status,bytes:size}};
  if(!object(json)&&!Array.isArray(json))
    return {status:'UNSUPPORTED_ROOT',httpStatus:response.status,bytes:size};
  const value={
    status:'PARSED_METADATA_ONLY',httpStatus:response.status,bytes:size,
    sha256:hash(bytes),rootType:Array.isArray(json)?'array':'object',
    topLevelEntries:Array.isArray(json)?json.length:Object.keys(json).length
  };
  // These values are strictly observations of publisher metadata, NEVER
  // proof of rows, license chain, historical timestamp, or RPL completeness.
  return value;
}
async function inspectCsvHeaders(fetchImpl,timeoutMs){
  let response;
  try{response=await request(fetchImpl,matchesCsvUrl,'HEAD',timeoutMs)}
  catch{return {status:'HEAD_UNREACHABLE_FROM_RUNNER',httpStatus:null}};
  if(!acceptableStatus(response.status))
    return {status:response.status===405||response.status===501?
      'HEAD_NOT_SUPPORTED':'HEAD_HTTP_NON_SUCCESS',httpStatus:response.status};
  const raw=response.headers.get('content-length');
  const length=raw!==null&&/^\d+$/.test(raw)?Number(raw):null;
  // A HEAD header does NOT prove an actual CSV row exists or is complete.
  return {
    status:'HEAD_METADATA_ONLY',httpStatus:response.status,
    contentLengthBytes:length!==null&&Number.isSafeInteger(length)?length:null,
    contentTypeClass:/csv/i.test(response.headers.get('content-type')??'')?
      'CSV_DECLARED':'NOT_DECLARED_CSV'
  };
}
export async function probeSourceMetadata({fetchImpl=fetch,timeoutMs=12000}={}){
  if(typeof fetchImpl!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
    throw new TypeError('Invalid probe arguments');
  const manifest=await inspectManifest(fetchImpl,timeoutMs);
  const matchesCsvHead=await inspectCsvHeaders(fetchImpl,timeoutMs);
  return {
    schemaVersion:1,
    researchOnly:true,paidAccessUsed:false,rawMatchRowsRetrieved:false,
    dataImportEnabled:false,modelTrainingAuthorized:false,
    publisherClaimNotRightsClearance:true,
    manifestUrl,matchesCsvUrl,
    manifest,matchesCsvHead,
    interpretation:'Endpoint observations on this runner only; no RPL completeness, accuracy, training rights, or historical as-of verification'
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await probeSourceMetadata();
    console.log(JSON.stringify(result,null,2));
  }catch(error){
    console.error('Probe contract error:',error.message);
    process.exitCode=1;
  }
}
