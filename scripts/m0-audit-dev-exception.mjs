// Strict M0 npm audit gate: fail for every new high/critical advisory.
// The ONE known unpatched dev-only vulnerability is visible and narrowly gated.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const knownAdvisory='GHSA-vfj7-8cjw-p6xm';
const knownBracesVersion='3.0.3';
const chain=new Map([
  ['braces',null],
  ['micromatch','braces'],
  ['fast-glob','micromatch'],
  ['@next/eslint-plugin-next','fast-glob'],
  ['eslint-config-next','@next/eslint-plugin-next']
]);
const severe=new Set(['high','critical']);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function reject(reason){throw new Error('Full npm audit rejected: '+reason)}

export function validateNpmAudit(audit,lock){
  if(!isObject(audit)||!isObject(audit.metadata?.vulnerabilities)||
     !isObject(audit.vulnerabilities))
    reject('missing npm audit JSON metadata or vulnerabilities');
  if(!isObject(lock)||lock.lockfileVersion!==3||!isObject(lock.packages))
    reject('missing v3 lockfile; no verifiable production/dev isolation');
  const packages=lock.packages;
  const high=Object.entries(audit.vulnerabilities).filter(([,value])=>
    isObject(value)&&severe.has(value.severity));
  const counts=audit.metadata.vulnerabilities;
  if(!Number.isSafeInteger(counts.high)||!Number.isSafeInteger(counts.critical)||
     high.length!==counts.high+counts.critical)
    reject('audit high/critical counts do not match individual findings');
  // A regular advisories summary can contain moderate/low findings, but
  // those cannot quietly escalate through an invalid severity value.
  for(const [name,value] of Object.entries(audit.vulnerabilities)){
    if(!isObject(value)||!['info','low','moderate','high','critical'].includes(value.severity))
      reject('unrecognized vulnerability entry '+name);
  }
  if(high.length===0)return {knownExceptionActive:false,knownAdvisory,highCount:0,
    allowedPackages:[]};
  // Direct braces advisory and transitive derivations are the ONLY high finding
  // the owner permits us to track while upstream has no patched npm version.
  const names=new Set(high.map(([name])=>name));
  if(names.size!==chain.size||[...chain.keys()].some(name=>!names.has(name)))
    reject('unapproved high/critical advisory, missing chain link or changed dependency');
  for(const [name,record] of high){
    if(record.severity!=='high'||record.name!==name||
       !Array.isArray(record.nodes)||record.nodes.length===0||!Array.isArray(record.via))
      reject('malformed/changed high finding for '+name);
    const path='node_modules/'+name;
    if(!isObject(packages[path])||packages[path].dev!==true)
      reject('vulnerable dependency is not dev-only in lockfile: '+name);
    if(record.nodes.some(node=>typeof node!=='string'||
      !node.endsWith(path)||packages[node]?.dev!==true))
      reject('vulnerable dependency may be reachable from production: '+name);
    if(name==='braces'){
      if(packages[path].version!==knownBracesVersion||
         record.via.length!==1||!isObject(record.via[0])||
         record.via[0].name!==name||
         record.via[0].url!==`https://github.com/advisories/${knownAdvisory}`||
         record.via[0].severity!=='high')
        reject('upstream braces advisory/version has changed; review the exception');
    }else{
      if(record.via.length!==1||record.via[0]!==chain.get(name))
        reject('unexpected high-severity dependency propagation for '+name);
    }
  }
  // A second braces installation under a nested node_modules directory may
  // have different flags even if npm audit did not surface its full path.
  for(const [path,entry] of Object.entries(packages)){
    if(path.endsWith('/node_modules/braces')&&
       (entry.dev!==true||entry.version!==knownBracesVersion))
      reject('additional braces copy is not the known dev-only 3.0.3 version');
  }
  const expectedEdges=[
    ['eslint-config-next','@next/eslint-plugin-next'],
    ['@next/eslint-plugin-next','fast-glob'],
    ['fast-glob','micromatch'],
    ['micromatch','braces']
  ];
  for(const [parent,child] of expectedEdges){
    const actual=packages['node_modules/'+parent]?.dependencies;
    if(!isObject(actual)||typeof actual[child]!=='string')
      reject('unverified lockfile dev dependency path: '+parent+' -> '+child);
  }
  return {knownExceptionActive:true,knownAdvisory,highCount:high.length,
    allowedPackages:[...names].sort()};
}
function main(){
  const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'));
  const command=spawnSync('npm',['audit','--json','--audit-level=high'],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024
  });
  if(command.error||![0,1].includes(command.status))
    reject('npm audit did not complete reliably (status '+String(command.status)+')');
  let report;
  try{report=JSON.parse(command.stdout)}
  catch{reject('npm audit failed to return valid JSON; refuse to silently pass')}
  const result=validateNpmAudit(report,lock);
  if(result.knownExceptionActive){
    console.warn('TRACKED dev-only '+result.knownAdvisory+': braces@'+knownBracesVersion+
      ' upstream has no patched release; exactly '+result.highCount+
      ' high dependency-chain findings accounted for. NOT a security fix.');
  }else{
    console.log('PASS: npm full audit reports zero high/critical findings');
  }
  console.log('PASS: full audit mandatory; no new high/critical vulnerabilities permitted');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{main()}catch(error){console.error(error.message);process.exitCode=1}
}
