import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {summarizeFootbolno,summarizeSportScore} from '../lib/source-preview-core.mjs';

test('Footbolno open RPL endpoint yields an aggregate-only preview',()=>{
 const result=summarizeFootbolno({
  updated:'2026-10-22T12:00:00Z',
  standings:[{team:'Fictional FC',privateTag:'NOT_EXPORTABLE'}]
 });
 assert.deepEqual(result,{provider:'footbolno',count:1,updated:'2026-10-22T12:00:00Z',examples:[]});
 assert.doesNotMatch(JSON.stringify(result),/Fictional FC|NOT_EXPORTABLE/);
 assert.throws(()=>summarizeFootbolno({standings:'wrong'}),/Invalid/);
 assert.throws(()=>summarizeFootbolno({standings:new Array(101).fill({})}),/Invalid/);
});

test('SportScore public football sample is bounded, attributed and never a season claim',()=>{
 const result=summarizeSportScore({sport:'football',matches:[
  {home:'Fictional Home',away:'Fictional Away',status:'finished',
   internal_upstream_key:'DO_NOT_EXPORT',home_score:4,away_score:1}
 ]});
 assert.equal(result.provider,'sportscore');
 assert.equal(result.count,1);
 assert.deepEqual(result.examples,[{home:'Fictional Home',away:'Fictional Away',status:'finished'}]);
 assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPORT|home_score/);
 assert.throws(()=>summarizeSportScore({matches:new Array(11).fill({})}),/Invalid/);
 assert.throws(()=>summarizeSportScore({matches:[null]}),/Unexpected/);
 assert.equal(summarizeSportScore({matches:[]}).count,0);
});

test('only manual direct CORS requests to bounded official published API URLs; no storage or auth',()=>{
 const s=readFileSync(new URL('../components/open-provider-preview.tsx',import.meta.url),'utf8');
 assert.match(s,/https:\/\/footbolno\.ru\/data\/league\/235\.json/);
 assert.match(s,/https:\/\/sportscore\.com\/api\/widget\/matches\/\?sport=football&limit=10/);
 assert.match(s,/const inspect=async\(provider:Provider\)/);
 assert.match(s,/onClick=\{\(\)=>inspect\('footbolno'\)\}/);
 assert.match(s,/onClick=\{\(\)=>inspect\('sportscore'\)\}/);
 assert.match(s,/method:'GET',credentials:'omit',cache:'no-store'/);
 assert.match(s,/redirect:'error'/);
 assert.match(s,/referrerPolicy:'no-referrer'/);
 assert.match(s,/AbortSignal\.timeout\(10000\)/);
 assert.match(s,/const cooldownMs=60000/);
 assert.match(s,/const maxResponseCharacters=512\*1024/);
 assert.match(s,/title="Sports data by SportScore">Powered by SportScore/);
 assert.match(s,/footbolno\.ru\/otkrytye-dannye/);
 assert.doesNotMatch(s,/useEffect\(|setInterval\(|localStorage|sessionStorage|createClient\(|supabase|POST|PUT|DELETE|Authorization|apiKey|service_role/);
 const dataPage=readFileSync(new URL('../app/(console)/data/page.tsx',import.meta.url),'utf8');
 assert.match(dataPage,/import \{OpenProviderPreview\} from '@\/components\/open-provider-preview'/);
 assert.match(dataPage,/<OpenProviderPreview\/>/);
 const sourceRegistry=JSON.parse(readFileSync(new URL('../../../docs/M0_FREE_SOURCE_REGISTRY.json',import.meta.url),'utf8'));
 for(const id of ['footbolno','sportscore']){
  const v=sourceRegistry.sources.find(x=>x.id===id);
  assert.ok(v);
  assert.equal(v.active,false);
  assert.equal(v.authorizedAutomatedTraining,false);
 }
 assert.equal(sourceRegistry.policy.activeProviderIntegrations,0);
});
