// Closed-schema numeric-only receipt; never print private fixture data.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const refuse=()=>{throw Error('Private historical import receipt refused');};
export function checkPrivateHistoryReceipt(r){
  const keys=['schemaVersion','kind','source','sourceOnly','storedSeasons',
    'storedMatchesVerified','insertedNewSnapshots','existingSnapshotsVerified',
    'historicalPrematchVerified','modelTrainingApproved','holdoutRead',
    'publicRecordsWritten'];
  if(!r||typeof r!=='object'||Array.isArray(r)||
     Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||
     r.schemaVersion!==1||r.kind!=='M2_PRIVATE_RPL_HISTORY_COMMIT'||
     r.source!=='OpenFoot Starter'||r.sourceOnly!==true||
     r.storedSeasons!==7||r.storedMatchesVerified!==1680||
     !Number.isSafeInteger(r.insertedNewSnapshots)||r.insertedNewSnapshots<0||
     r.insertedNewSnapshots>7||
     r.existingSnapshotsVerified!==7-r.insertedNewSnapshots||
     r.historicalPrematchVerified!==false||r.modelTrainingApproved!==false||
     r.holdoutRead!==false||r.publicRecordsWritten!==0)refuse();
  return Object.freeze(r);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)refuse();
    const b=readFileSync(process.argv[2]);
    if(!b.length||b.length>4096)refuse();
    console.log(JSON.stringify(checkPrivateHistoryReceipt(JSON.parse(b.toString('utf8')))));
  }catch{
    console.error('FAIL: M2 private history receipt invalid');
    process.exitCode=2;
  }
}
