// M0 local CLI adapter. No HTTP, DB, ingestion or model training.
import {createHash} from 'node:crypto';
import {readFileSync,openSync,fstatSync,closeSync,constants} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {evaluateSourceEvidenceCore} from './m0-multi-source-core.mjs';
const registry=JSON.parse(readFileSync(new URL('../docs/M0_FREE_SOURCE_REGISTRY.json',import.meta.url),'utf8'));
export function evaluateSourceEvidence(input, options={}){
  return {...evaluateSourceEvidenceCore(input,registry,options),
    inputDigestSHA256:createHash('sha256').update(JSON.stringify(input)).digest('hex')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3){
    console.error('Usage: node scripts/m0-multi-source-quality.mjs LOCAL_EVIDENCE_JSON');
    process.exitCode=2;
  }else{
    try{
      const fd=openSync(process.argv[2],constants.O_RDONLY|(constants.O_NOFOLLOW??0));
      let bytes;
      try{
        const info=fstatSync(fd);
        if(!info.isFile()||info.size>4*1024*1024)
          throw new Error('Evidence file must be a regular file <=4 MiB');
        bytes=readFileSync(fd);
        if(bytes.byteLength>4*1024*1024)throw new Error('Evidence file exceeds 4 MiB');
      }finally{closeSync(fd)}
      const result=evaluateSourceEvidence(JSON.parse(bytes.toString('utf8')));
      console.log(JSON.stringify(result,null,2));
    }catch(error){
      console.error('Evidence validation failed: '+error.message);
      process.exitCode=2;
    }
  }
}
