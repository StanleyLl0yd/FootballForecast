#!/usr/bin/env node
/** Independent A8 whole-repository pass: one of technical or security.
 * Inspect every tracked file, including docs, workflows, binaries and tests.
 * No HTTP, database, secret access or output of matched file contents.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstatSync,readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=x=>createHash('sha256').update(x).digest('hex');
const decoder=new TextDecoder('utf-8',{fatal:true});
const isCode=p=>/\.(?:mjs|cjs|js|jsx|ts|tsx|py|sql|sh|ps1)$/.test(p);
const isWorkflow=p=>p.startsWith('.github/workflows/')&&/\.(?:yml|yaml)$/.test(p);
const finding=(p,rule,n=0)=>({path:p,rule,line:n});

/** Pure exhaustive scan; input can be supplied by isolated synthetic tests. */
export function inspectTrackedFiles(files,pass){
  if(!Array.isArray(files)||!['technical','security'].includes(pass))
    throw new TypeError('unknown audit inputs');
  const errors=[],warnings=[],seen=new Set(),manifest=[];
  let bytes=0,source=0,documents=0,workflows=0,nonUtf8=0;
  for(const f of files){
    if(typeof f.path!=='string'||!Buffer.isBuffer(f.body))
      throw new TypeError('bad tracked file input');
    const p=f.path,b=f.body;bytes+=b.length;
    manifest.push(p+'\0'+b.length+'\0'+sha(b));
    if(p.includes('..')||p.startsWith('/')||p.includes('\\')||p.includes('\0'))
      errors.push(finding(p,'UNSAFE_PATH'));
    if(seen.has(p.toLowerCase()))errors.push(finding(p,'CASE_COLLISION'));
    seen.add(p.toLowerCase());
    if(isCode(p))source++;
    if(isWorkflow(p))workflows++;
    if(/\.(?:json|md|txt)$/.test(p))documents++;
    let text;
    try{text=decoder.decode(b);}
    catch{nonUtf8++;if(isCode(p)||isWorkflow(p)||p.endsWith('.json'))
      errors.push(finding(p,'INVALID_UTF8_SOURCE'));continue;}
    if(pass==='technical'){
      if(p.endsWith('.json')){
        try{JSON.parse(text);}catch{errors.push(finding(p,'INVALID_JSON'));}
      }
      if(isWorkflow(p)&&text.includes('\t'))
        errors.push(finding(p,'WORKFLOW_TAB'));
      if(isCode(p)){
        const lines=text.split('\n');
        for(let i=0;i<lines.length;i++)if(/\b(?:TODO|FIXME|HACK)\b/.test(lines[i])&&
            !/(?:test|fixture|example)/i.test(p))
          warnings.push(finding(p,'UNFINISHED_CODE_MARKER',i+1));
      }
      if(p==='apps/web/app/(console)/models/page.tsx'&&
         text.includes('M3 открыт, 2/8 критериев'))
        errors.push(finding(p,'STALE_ACTIVE_M3_STATUS'));
      if(p==='apps/web/app/(console)/admin/research/page.tsx'&&
         (!text.includes('await requireOwner()')||
          !text.includes('M3DevelopmentWorkbench summary={m3Development}')))
        errors.push(finding(p,'M3_OWNER_UI_BROKEN'));
    }else{
      if(/(^|\/)\.env(?:\.local|\.production|\.development)?$/.test(p)||
         /(?:^|\/)(?:id_rsa|id_ed25519|credentials\.json)$/.test(p)||
         /\.(?:p12|pfx|key)$/.test(p))
        errors.push(finding(p,'TRACKED_SECRET_FILE'));
      if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)){
        const out=/(?:test|fixture|example|README|\.md$)/i.test(p)?warnings:errors;
        out.push(finding(p,'PRIVATE_KEY_LITERAL'));
      }
      if(/(?:AKIA[0-9A-Z]{16}|gh[opsu]_[A-Za-z0-9_]{32,})/.test(text)){
        const out=/(?:test|fixture|example|README|\.md$)/i.test(p)?warnings:errors;
        out.push(finding(p,'TOKEN_SHAPED_LITERAL'));
      }
      if(isWorkflow(p)){
        const lines=text.split('\n');
        for(let i=0;i<lines.length;i++){
          const line=lines[i];
          if(/^\s*pull_request_target:/.test(line))
            errors.push(finding(p,'PRIVILEGED_FORK_TRIGGER',i+1));
          if(/^\s*permissions:\s*write-all/.test(line))
            errors.push(finding(p,'GLOBAL_WRITE_ALL',i+1));
          if(/^\s*set -x(?:\s|$)/.test(line))
            errors.push(finding(p,'SHELL_TRACING',i+1));
          const action=line.match(/^\s*-\s*uses:\s*(\S+)/);
          if(action&&!action[1].startsWith('./')&&
             !/@[a-f0-9]{40}$/.test(action[1]))
            errors.push(finding(p,'UNPINNED_ACTION',i+1));
        }
      }
      if(p.startsWith('apps/web/app/')&&isCode(p)&&
         /(?:SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_[A-Z_]*(?:SECRET|PRIVATE_KEY)|ff_private\.ff_rpl_history_matches)/.test(text))
        errors.push(finding(p,'PRIVILEGED_BROWSER_ROUTE'));
      if(p==='apps/web/components/m3-development-workbench.tsx'&&
         /(?:fetch\s*\(|supabase|service_role|eval\s*\()/.test(text))
        errors.push(finding(p,'M3_CLIENT_PRIVILEGED_IO'));
      if(p==='apps/web/app/(console)/admin/research/page.tsx'&&
         (!text.includes('await requireOwner()')||
          text.indexOf('await requireOwner()')>
          text.indexOf('const m3Development=inspectM3OwnerDevelopment')))
        errors.push(finding(p,'M3_OWNER_AUTH_ORDER'));
    }
  }
  return {pass,fileCount:files.length,bytes,source,documents,workflows,nonUtf8,
    manifestSha256:sha(manifest.sort().join('\n')),errors,warnings};
}

export function readTrackedFiles(root=ROOT){
  const paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'buffer'})
    .toString('utf8').split('\0').filter(Boolean);
  return paths.map(path=>{
    const full=join(root,path);
    if(!lstatSync(full).isFile())throw Error('nonregular tracked path '+path);
    return {path,body:readFileSync(full)};
  });
}

function checkCoreGates(files,pass){
  const file=name=>files.find(x=>x.path===name)?.body.toString('utf8');
  const required=[
    'apps/web/app/(console)/admin/research/page.tsx',
    'apps/web/lib/m3-owner-development.mjs',
    'apps/web/components/m3-development-workbench.tsx',
    'research/sql/m3_development_poisson_observation.sql',
    'research/sql/m3_480_owner_correspondence.sql',
    'docs/M3_A3_SEVEN_SEASON_RETROSPECTIVE_READINESS_2026-11-11.json',
    'docs/M3_A4_A5_A6_REAL_DEVELOPMENT_2026-11-11.json',
    '.github/workflows/ci.yml','.github/workflows/security.yml',
    '.github/workflows/codeql.yml'
  ];
  for(const p of required)if(!file(p))throw Error('missing source '+p);
  const a3=JSON.parse(file(required[5])),dev=JSON.parse(file(required[6]));
  if(a3.totals.scoreFreeGraphMatches!==1680||
     a3.totals.retrospectivePlayedScoreCandidates!==1673||
     a3.scope.holdout2025_26Read!==false||
     dev.protectedReceipt.candidateScoredMatches!==1197||
     dev.limitations.consumedHoldout2025_26Access!==false)
    throw Error('invalid historical model boundary');
  if(pass==='technical'){
    const ci=file('.github/workflows/ci.yml');
    for(const marker of ['python -m pytest','ruff check ml','node --test',
      'PostgreSQL','safari-compatibility','browser-compatibility','production-smoke'])
      if(!ci.includes(marker))throw Error('CI coverage absent: '+marker);
  }else{
    if(!file('.github/workflows/security.yml').includes('npm audit --audit-level=high')||
       !file('.github/workflows/security.yml').includes('gitleaks')||
       !file('.github/workflows/codeql.yml').includes('javascript-typescript, python')||
       !file('database/tests/0022_m2_private_rpl_history.sql')||
       !file('database/tests/0023_m2_private_one_use_fixed_evaluation.sql')||
       !file('.github/workflows/m3-owner-two-season-crosswalk.yml'))
      throw Error('private-RLS, dependency or secret gates absent');
  }
}

function main(){
  const pass=process.argv.find(x=>x.startsWith('--pass='))?.slice(7);
  if(!['technical','security'].includes(pass))
    throw Error('select --pass=technical or --pass=security');
  const files=readTrackedFiles(),result=inspectTrackedFiles(files,pass);
  const errors=[...result.errors];
  try{
    if(result.fileCount<450)throw Error('incomplete whole-repo inventory');
    checkCoreGates(files,pass);
  }catch{errors.push(finding('repository','REQUIRED_GATE_FAILED'));}
  console.log('M3_A8_PASS='+result.pass);
  console.log('M3_A8_TRACKED_FILES='+result.fileCount);
  console.log('M3_A8_SOURCE_FILES='+result.source);
  console.log('M3_A8_WORKFLOWS='+result.workflows);
  console.log('M3_A8_TOTAL_BYTES='+result.bytes);
  console.log('M3_A8_MANIFEST_SHA256='+result.manifestSha256);
  console.log('M3_A8_ERRORS='+errors.length);
  console.log('M3_A8_WARNINGS='+result.warnings.length);
  for(const x of errors.slice(0,25))console.log('AUDIT_BLOCKER '+JSON.stringify(x));
  for(const x of result.warnings.slice(0,20))
    console.log('AUDIT_REVIEW '+JSON.stringify(x));
  if(errors.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
