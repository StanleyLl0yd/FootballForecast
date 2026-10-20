import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {manifestUrl,matchesCsvUrl,probeSourceMetadata} from '../scripts/m0-footbolno-metadata.mjs';

function fixture(manifest={license:'publisher-claim-CC-BY-4.0',leagues:[235]}){
  const calls=[],raw=JSON.stringify(manifest);
  const fetchImpl=async(url,init)=>{
    calls.push({url,init});
    if(url===manifestUrl)return new Response(raw,{status:200,headers:{
      'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(raw))
    }});
    if(url===matchesCsvUrl)return new Response(null,{status:200,headers:{
      'Content-Type':'text/csv','Content-Length':'543210'
    }});
    throw Error('Unexpected origin');
  };
  return {fetchImpl,calls,raw};
}
test('only immutable allowed endpoints and methods; JSON manifest is bounded, CSV HEAD-only',async()=>{
  const {fetchImpl,calls,raw}=fixture();
  const report=await probeSourceMetadata({fetchImpl});
  assert.equal(report.schemaVersion,1);
  assert.deepEqual(calls.map(c=>[c.url,c.init.method]),
    [[manifestUrl,'GET'],[matchesCsvUrl,'HEAD']]);
  for(const c of calls){
    assert.equal(c.init.redirect,'error');
    assert.equal(c.init.credentials,'omit');
    assert.equal(c.init.cache,'no-store');
    assert.ok(c.init.signal);
  }
  assert.equal(report.manifest.status,'PARSED_METADATA_ONLY');
  assert.equal(report.manifest.sha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(report.manifest.topLevelEntries,2);
  assert.equal(report.matchesCsvHead.status,'HEAD_METADATA_ONLY');
  assert.equal(report.matchesCsvHead.contentTypeClass,'CSV_DECLARED');
  assert.equal(report.matchesCsvHead.contentLengthBytes,543210);
  assert.equal(report.researchOnly,true);
  assert.equal(report.publisherClaimNotRightsClearance,true);
  assert.equal(report.modelTrainingAuthorized,false);
  assert.equal(report.rawMatchRowsRetrieved,false);
  assert.equal(report.dataImportEnabled,false);
  assert.equal(report.paidAccessUsed,false);
  assert.ok(!JSON.stringify(report).includes('publisher-claim'));
});
test('network failure is inconclusive, never false coverage or licensing evidence',async()=>{
  const calls=[];
  const report=await probeSourceMetadata({fetchImpl:async(url,init)=>{
    calls.push([url,init.method]);
    throw Error('DNS blocked or private information');
  }});
  assert.deepEqual(calls,[[manifestUrl,'GET'],[matchesCsvUrl,'HEAD']]);
  assert.equal(report.manifest.status,'UNREACHABLE_FROM_RUNNER');
  assert.equal(report.matchesCsvHead.status,'HEAD_UNREACHABLE_FROM_RUNNER');
  assert.ok(!JSON.stringify(report).includes('private information'));
});
test('invalid/unknown publisher JSON never passes as parsed metadata',async()=>{
  for(const payload of ['not JSON','false','null','""','']){
    const report=await probeSourceMetadata({fetchImpl:async(url)=>
      url===manifestUrl?
        new Response(payload,{status:200}):
        new Response(null,{status:405})
    });
    assert.notEqual(report.manifest.status,'PARSED_METADATA_ONLY');
    assert.equal(report.matchesCsvHead.status,'HEAD_NOT_SUPPORTED');
  }
});
test('oversized Content-Length and streamed bytes fail before reporting a digest',async()=>{
  const large=new Response('{}',{status:200,headers:{'content-length':'1000000'}});
  const one=await probeSourceMetadata({fetchImpl:async url=>
    url===manifestUrl?large:new Response(null,{status:204})});
  assert.equal(one.manifest.status,'OVER_LIMIT');
  assert.ok(!('sha256' in one.manifest));
  const two=await probeSourceMetadata({fetchImpl:async url=>
    url===manifestUrl?
      new Response(' '.repeat(65537),{status:200}):
      new Response(null,{status:204})});
  assert.equal(two.manifest.status,'OVER_LIMIT');
  assert.ok(!('sha256' in two.manifest));
});
test('server refusing metadata or HEAD yields explicit HTTP evidence, no raw values',async()=>{
  const rep=await probeSourceMetadata({fetchImpl:async url=>
    url===manifestUrl?
      new Response('blocked',{status:403}):
      new Response(null,{status:405})});
  assert.deepEqual(rep.manifest,{status:'HTTP_NON_SUCCESS',httpStatus:403});
  assert.deepEqual(rep.matchesCsvHead,{status:'HEAD_NOT_SUPPORTED',httpStatus:405});
});
test('no URL override, paid tier, extra fetch methods or record contents are present',async()=>{
  const {fetchImpl,calls}=fixture({data:['confidential entry']});
  const report=await probeSourceMetadata({fetchImpl});
  assert.equal(calls.length,2);
  assert.ok(!JSON.stringify(report).includes('confidential'));
  for(const [args,pattern] of [
    [{timeoutMs:31000},/Invalid probe arguments/],
    [{timeoutMs:0},/Invalid probe arguments/],
    [{fetchImpl:null},/Invalid probe arguments/]
  ])await assert.rejects(probeSourceMetadata(args),pattern);
});
