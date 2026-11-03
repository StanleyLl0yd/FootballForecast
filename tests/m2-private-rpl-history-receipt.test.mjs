import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPrivateHistoryReceipt} from '../scripts/m2-private-rpl-history-receipt.mjs';
const receipt=()=>({
  schemaVersion:1,kind:'M2_PRIVATE_RPL_HISTORY_COMMIT',source:'OpenFoot Starter',
  sourceOnly:true,storedSeasons:7,storedMatchesVerified:1680,
  insertedNewSnapshots:7,existingSnapshotsVerified:0,
  historicalPrematchVerified:false,modelTrainingApproved:false,
  holdoutRead:false,publicRecordsWritten:0
});
test('allowlisted owner aggregate only',()=>{
  assert.equal(checkPrivateHistoryReceipt(receipt()).storedMatchesVerified,1680);
  for(const [key,value] of [
    ['storedMatchesVerified',1679],['holdoutRead',true],
    ['publicRecordsWritten',1],['sourceOnly',false],
    ['insertedNewSnapshots',8]
  ])assert.throws(()=>checkPrivateHistoryReceipt({...receipt(),[key]:value}),/refused/);
  assert.throws(()=>checkPrivateHistoryReceipt({...receipt(),sourceTeam:'leaked'}),/refused/);
});
