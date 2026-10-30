import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const root=new URL('../.github/workflows/',import.meta.url);
test('all workflow checkouts disable persisted credentials, including privileged source import',()=>{
  const files=readdirSync(root).filter(name=>name.endsWith('.yml')||name.endsWith('.yaml'));
  assert.ok(files.length>=10);
  let checked=0;
  for(const name of files){
    const lines=readFileSync(new URL(name,root),'utf8').split('\n');
    for(let i=0;i<lines.length;i++){
      if(!/^\s*- uses: actions\/checkout@[a-f0-9]{40}/.test(lines[i]))continue;
      checked++;
      const linesAfter=[];
      for(let j=i+1;j<lines.length&&j<=i+7;j++){
        if(/^\s*- (?:name:|uses:|run:)/.test(lines[j]))break;
        linesAfter.push(lines[j]);
      }
      assert.match(linesAfter.join('\n'),/persist-credentials:\s*false/,
        `${name} checkout #${checked} must not save token in git config`);
    }
  }
  assert.ok(checked>=15, 'expected all known workflows with checked-out sources');
});
