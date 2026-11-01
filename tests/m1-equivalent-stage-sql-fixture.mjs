// Synthetic-only exact-equivalence / true historical-drift fixture for PG17 CI.
import {createHash} from 'node:crypto';
import {fixture} from './fixtures/m1-synthetic-dataset.mjs';
import {validateStageDataset,buildStageSql} from '../scripts/m1-stage-import.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const variant=process.argv[2];
const cases={
  equivalent:{version:'v2',retrieved:'2026-10-29T15:30:00Z'},
  changed:{version:'v3',retrieved:'2026-10-29T16:00:00Z'},
  'out-of-order':{version:'v4',retrieved:'2026-10-29T15:45:00Z'},
  holdout:{version:'v5',retrieved:'2026-10-29T16:30:00Z'},
  'tampered-replay':{version:'v2',retrieved:'2026-10-29T17:00:00Z'}
};
if(!Object.hasOwn(cases,variant))throw Error('Unknown synthetic fixture mode');
const data=fixture();
const rawSha=sha('synthetic-source-bytes-'+cases[variant].version);
data.manifest.sourceFileSha256=rawSha;
data.manifest.retrievedAtUtc=cases[variant].retrieved;
for(const season of Object.keys(data.seasonFiles)){
  const rows=data.seasonFiles[season].trimEnd().split('\n').map(line=>JSON.parse(line));
  for(const row of rows)row.sourceFileSha256=rawSha;
  if((variant==='changed'||variant==='tampered-replay')&&season==='2024/2025')rows[0].homeGoals=3;
  if(variant==='holdout'&&season==='2025/2026')rows[0].awayGoals=2;
  data.seasonFiles[season]=rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
  data.manifest.snapshotSHA256[season]=sha(Buffer.from(data.seasonFiles[season]));
}
process.stdout.write(buildStageSql(validateStageDataset(data.manifest,data.seasonFiles)));
