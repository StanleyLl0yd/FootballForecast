import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import registry from '../docs/M0_FREE_SOURCE_REGISTRY.json' with {type:'json'};
import {evaluateSourceEvidence} from '../scripts/m0-multi-source-quality.mjs';
import {evaluateSourceEvidenceCore} from '../scripts/m0-multi-source-core.mjs';

const sample=(n=36)=>({schemaVersion:1,cases:Array.from({length:n},(_,i)=>{
  const day=String(i%28+1).padStart(2,'0');
  const month=String(1+Math.floor(i/28)).padStart(2,'0');
  const when=`2025-${month}-${day}T19:00:00Z`;
  const official={homeId:'Home-'+i,awayId:'Away-'+i,kickoffAt:when,
    status:'played',homeGoals:1,awayGoals:0};
  const observation=(sourceId,changes={})=>({
    sourceId,publisherGroup:'unverified-shared-provider',publishedAt:null,
    observedAt:'2026-10-19T13:00:00Z',...official,...changes
  });
  return {key:'match-'+i,officialEvidenceUrl:`https://example.org/synthetic/${i}`,
    official,observations:[
      observation('openfootball-europe'),
      ...(i%7===0?[]:[observation('footbolno',i%5===0?{awayGoals:1}:{})])
    ]};
})});

test('browser-pure and CLI adapters produce byte-for-byte equivalent metrics and guard flags',()=>{
  const input=sample();
  const core=evaluateSourceEvidenceCore(input,registry);
  const cli=evaluateSourceEvidence(input);
  const {inputDigestSHA256,...withoutHash}=cli;
  assert.match(inputDigestSHA256,/^[0-9a-f]{64}$/);
  assert.deepEqual(core,withoutHash);
  assert.equal(core.fieldRankings.fixtureIntegrity.length,2);
  assert.equal(core.fieldRankings.fixtureIntegrity[0].sourceId,'openfootball-europe');
  assert.equal(core.officialReferenceAuthenticityVerified,false);
  assert.equal(core.eligibleForProduction,false);
});

test('browser core rejects paid registry mutations and malformed evidence identically to CLI',()=>{
  const modified=structuredClone(registry);
  modified.policy.maxMonthlySpendUSD=1;
  assert.throws(()=>evaluateSourceEvidenceCore(sample(1),modified),/free-only source registry/);
  for(const tweak of [
    value=>{value.cases[0].official.status='live'},
    value=>{value.cases[0].observations[0].sourceId='unknown-provider'},
    value=>{value.cases[0].observations[0].observedAt='2020-01-01T00:00:00Z'}
  ]){
    const v=sample(1);
    tweak(v);
    assert.throws(()=>evaluateSourceEvidence(v));
    assert.throws(()=>evaluateSourceEvidenceCore(v,registry));
  }
});

test('browser UI only reads a local file and never posts private observations to servers',()=>{
  const path=new URL('../apps/web/components/source-evidence-lab.tsx',import.meta.url);
  const code=readFileSync(path,'utf8');
  assert.match(code,/^'use client';/);
  assert.match(code,/file\.arrayBuffer\(\)/);
  assert.match(code,/TextDecoder\('utf-8',\{fatal:true\}\)/);
  assert.match(code,/evaluateSourceEvidenceCore\(candidate,registry\)/);
  assert.match(code,/file\.size===0\|\|file\.size>maxBytes/);
  assert.match(code,/crypto\.subtle\.digest\('SHA-256',bytes\)/);
  assert.doesNotMatch(code,/\b(fetch|sendBeacon|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB)\s*(\(|\.)/);
  assert.doesNotMatch(code,/\b(useEffect|createServerAction|formAction)\s*\(/);
  assert.doesNotMatch(code,/use server|service.role|NEXT_PUBLIC_SUPABASE/);
});

test('shared pure evaluator avoids filesystem, network, crypto and host-specific imports',()=>{
  const code=readFileSync(new URL('../scripts/m0-multi-source-core.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/from ['"]node:/);
  assert.doesNotMatch(code,/\b(fetch|require|XMLHttpRequest|WebSocket|localStorage|indexedDB)\s*\(/);
  assert.doesNotMatch(code,/\breadFileSync\s*\(/);
  assert.equal(evaluateSourceEvidenceCore({schemaVersion:1,cases:[]},registry).observationCount,0);
});

test('research example and exported report contain no real match rows or uploaded raw evidence',()=>{
  const code=readFileSync(new URL('../apps/web/components/source-evidence-lab.tsx',import.meta.url),'utf8');
  assert.match(code,/SYNTHETIC-NOT-A-REAL-MATCH-001/);
  assert.match(code,/example\.org\/fictional\/001/);
  assert.match(code,/Fictional-Home/);
  assert.match(code,/originalFileSHA256:fileHash/);
  assert.match(code,/URL\.createObjectURL\(new Blob/);
  assert.match(code,/URL\.revokeObjectURL\(url\)/);
  assert.match(code,/footballforecast-synthetic-example\.json/);
  assert.match(code,/footballforecast-research-report\.json/);
  assert.doesNotMatch(code,/downloadLocalJson\([^)]*candidate/);
});
