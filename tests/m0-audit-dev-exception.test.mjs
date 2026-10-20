import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {validateNpmAudit} from '../scripts/m0-audit-dev-exception.mjs';

const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
const names=['braces','micromatch','fast-glob','@next/eslint-plugin-next','eslint-config-next'];
const parent={
  micromatch:'braces','fast-glob':'micromatch',
  '@next/eslint-plugin-next':'fast-glob','eslint-config-next':'@next/eslint-plugin-next'
};
function example(){
  const vulnerabilities=Object.fromEntries(names.map(name=>[name,{
    name,severity:'high',isDirect:false,range:'*',
    via:name==='braces'?[{
      name:'braces',severity:'high',
      url:'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
    }]:[parent[name]],
    nodes:['node_modules/'+name],fixAvailable:false
  }]));
  return {auditReportVersion:2,metadata:{vulnerabilities:{
    info:0,low:0,moderate:0,high:5,critical:0,total:5
  }},vulnerabilities};
}
const verify=a=>validateNpmAudit(a,lock);
test('real v3 lockfile confirms every allowed chain link is only dev and braces is 3.0.3',()=>{
  assert.equal(lock.packages['node_modules/braces'].version,'3.0.3');
  assert.equal(lock.packages['node_modules/braces'].dev,true);
  const result=verify(example());
  assert.equal(result.knownExceptionActive,true);
  assert.equal(result.highCount,5);
  assert.deepEqual(result.allowedPackages,[...names].sort());
});
test('empty audit succeeds, allowing eventual removal of upstream advisory',()=>{
  const audit={metadata:{vulnerabilities:{high:0,critical:0}},vulnerabilities:{}};
  assert.deepEqual(verify(audit).knownExceptionActive,false);
});
test('new direct or transitive HIGH vulnerabilities fail even with the known advisory',()=>{
  let x=example();x.vulnerabilities['new-malicious-advisory']={
    name:'new-malicious-advisory',severity:'high',via:[],nodes:['node_modules/new'],
  };
  x.metadata.vulnerabilities.high++;
  assert.throws(()=>verify(x),/unapproved high/);
  x=example();x.vulnerabilities.braces.via.push({
    name:'braces',severity:'high',url:'https://github.com/advisories/GHSA-NEW-ADVISORY'
  });
  assert.throws(()=>verify(x),/advisory\/version has changed/);
  x=example();x.vulnerabilities.micromatch.via.push({name:'micromatch',
    severity:'critical',url:'https://github.com/advisories/GHSA-NEW-ADVISORY'});
  assert.throws(()=>verify(x),/unexpected high-severity/);
});
test('any introduced CRITICAL severity fails instead of being swept into exception',()=>{
  const x=example();x.vulnerabilities.braces.severity='critical';
  x.metadata.vulnerabilities.high--;x.metadata.vulnerabilities.critical++;
  assert.throws(()=>verify(x),/malformed\/changed high/);
});
test('reject altered advisory identity, missing chain or unsupported propagated edges',()=>{
  let x=example();x.vulnerabilities.braces.via[0].url='https://github.com/advisories/GHSA-other';
  assert.throws(()=>verify(x),/braces advisory\/version/);
  x=example();x.vulnerabilities['fast-glob'].via=['other-package'];
  assert.throws(()=>verify(x),/unexpected high-severity/);
  x=example();delete x.vulnerabilities['fast-glob'];
  x.metadata.vulnerabilities.high--;
  assert.throws(()=>verify(x),/unapproved high/);
});
test('dev-only property is checked for exact vulnerable lockfile paths',()=>{
  const x=example();
  let copy=structuredClone(lock);
  copy.packages['node_modules/braces'].dev=false;
  assert.throws(()=>validateNpmAudit(x,copy),/not dev-only/);
  copy=structuredClone(lock);
  copy.packages['node_modules/fast-glob'].dev=false;
  assert.throws(()=>validateNpmAudit(x,copy),/not dev-only/);
  copy=structuredClone(lock);
  copy.packages['node_modules/external/node_modules/braces']={
    dev:false,version:'3.0.3'
  };
  assert.throws(()=>validateNpmAudit(x,copy),/additional braces copy/);
  copy=structuredClone(lock);
  delete copy.packages['node_modules/@next/eslint-plugin-next'].dependencies['fast-glob'];
  assert.throws(()=>validateNpmAudit(x,copy),/unverified lockfile dev dependency path/);
});
test('unknown nested locations and advisory metadata inconsistencies fail closed',()=>{
  let x=example();x.vulnerabilities.braces.nodes.push('node_modules/deep/node_modules/braces');
  assert.throws(()=>verify(x),/may be reachable from production/);
  x=example();x.metadata.vulnerabilities.high=10;
  assert.throws(()=>verify(x),/counts do not match/);
  x=example();x.vulnerabilities.braces.severity='unknown';
  assert.throws(()=>verify(x),/counts do not match/);
  assert.throws(()=>verify({error:'network error'}),/missing npm audit JSON/);
});
test('LOW or MODERATE remain visible in raw npm audit but do not mask high gating',()=>{
  const x=example();x.vulnerabilities['low-only']={
    name:'low-only',severity:'low',via:[],nodes:['node_modules/low-only']
  };
  assert.equal(verify(x).knownExceptionActive,true);
});
